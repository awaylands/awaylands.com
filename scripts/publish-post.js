'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const {execFileSync, spawnSync} = require('node:child_process');
const {parse, print, Kind} = require('graphql');
const yaml = require('js-yaml');
const {S3Client, GetObjectCommand, GetObjectAclCommand, PutObjectCommand} = require('@aws-sdk/client-s3');

const ROOT = path.resolve(__dirname, '..');
const STATE = path.join(ROOT, '.post-publisher');
const SITE = 'https://www.awaylands.com';
const PROJECT = 'decc50a7-e43f-4c99-b5e9-cc327d2e1b93';
const SITE_ID = '140c1641-564a-40a9-b13d-85eaec815d1d';
const NODE = '/Users/amyseder/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node';
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const manifest = () => JSON.parse(read('build/assets/manifest.json'));

function privateDirectory(dir) { fs.mkdirSync(dir, {recursive: true, mode: 0o700}); }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2), {mode: 0o600}); }
function config() {
  const c = JSON.parse(read('.takeshaperc'));
  if (c.projectId !== PROJECT || c.siteId !== SITE_ID || c.endpoint !== 'https://api.takeshape.io') throw new Error('Publisher configuration does not match the approved production site.');
  return c;
}
async function graphql(query, variables = {}, admin = false) {
  const c = config();
  const token = admin ? JSON.parse(fs.readFileSync(path.join(os.homedir(), '.takeshaperc'))).accessToken : c.linkedApiKey.apiKey;
  const headers = {'Content-Type': 'application/json', ...(token.split('.').length === 3 ? {'X-TakeShape-Token': token} : {Authorization: `Bearer ${token}`})};
  const response = await fetch(`${c.endpoint}${admin === true ? '/admin-graphql' : `/project/${PROJECT}/production/graphql`}`, {method: 'POST', headers, body: JSON.stringify({query, variables}), signal: AbortSignal.timeout(90000)});
  if (!response.ok) throw new Error(`TakeShape returned HTTP ${response.status}.`);
  const data = await response.json();
  if (data.errors?.length) throw new Error(data.errors.map(e => e.message).join('; '));
  return data.data;
}

function singleStoryQuery(source, id, alias = 'page') {
  if (!uuid(id)) throw new Error('Invalid post identifier.');
  const document = parse(source);
  const operation = document.definitions.find(d => d.kind === Kind.OPERATION_DEFINITION);
  const list = operation.selectionSet.selections.find(s => s.name?.value === 'getStoryList');
  const items = list?.selectionSet.selections.find(s => s.name?.value === 'items');
  if (!items) throw new Error('Story query structure changed; publisher needs an update.');
  operation.selectionSet.selections = [{kind: Kind.FIELD, name: {kind: Kind.NAME, value: 'getStory'}, alias: {kind: Kind.NAME, value: alias}, arguments: [{kind: Kind.ARGUMENT, name: {kind: Kind.NAME, value: '_id'}, value: {kind: Kind.STRING, value: id}}], selectionSet: items.selectionSet}];
  // Fragment definitions remain available for the search query.
  return print(document);
}
async function storyMeta(id) {
  if (!uuid(id)) throw new Error('Open a saved TakeShape story first.');
  const data = await graphql(`query($id:ID!){getStory(_id:$id){_id _status _updatedAt _enabledAt title slug isImportant category{title parentCategory{title}} mainCategory{title} location{title} continent{name} social{title description} tout{image{path} dek}}}`, {id});
  if (!data.getStory) throw new Error('This story no longer exists.');
  return data.getStory;
}
function storyPath(story) {
  const slug = story.slug;
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('This post needs a valid saved slug before quick publishing. Use Publish Site for legacy URLs.');
  return `/story/${slug}/`;
}
function normalizeUrl(url) { return String(url || '').replace(/^https:\/\/www\.awaylands\.com/, '').replace(/\/$/, ''); }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const names = list => (list || []).map(x => x.title || x.name).sort();
function classify(story, oldTitle, oldSearch) {
  const reasons = [];
  if (story._status !== 'enabled') reasons.push('The post is disabled or scheduled. Use a full site publish to update its visibility.');
  if (!oldTitle || !oldSearch) reasons.push('This is a new post or its public indexes need refreshing.');
  if (oldTitle && oldSearch) {
    if (story.title !== oldTitle.title || (story.social?.title || '') !== (oldTitle.socialTitle || '')) reasons.push('The title changed.');
    if (normalizeUrl(oldTitle.url) !== normalizeUrl(storyPath(story))) reasons.push('The URL changed.');
    if (!same(names(story.mainCategory), [...(oldTitle.mainCategories || [])].sort()) || !same(names(story.category), [...(oldTitle.subcategories || [])].sort())) reasons.push('The categories changed.');
    if (!same(names(story.location), [...(oldTitle.locations || [])].sort()) || !same(names(story.continent), [...(oldTitle.continents || [])].sort())) reasons.push('The destination or region changed.');
    if (Boolean(story.isImportant) !== Boolean(oldTitle.isImportant) || story._enabledAt !== oldTitle.enabledAt) reasons.push('The publication date or featured-post setting changed.');
    const previousImage = String(oldTitle.image || '');
    const currentImage = story.tout?.image?.path || '';
    if ((currentImage && !previousImage.includes(currentImage)) || (!currentImage && previousImage)) reasons.push('The cover image changed.');
    if ((story.tout?.dek || story.social?.description || '') !== (oldSearch.dek || '')) reasons.push('The preview text changed.');
  }
  return {mode: reasons.length ? 'site' : 'post', reasons};
}
async function publicJSON(file) {
  const response = await fetch(`${SITE}/${file}?publisher=${Date.now()}`, {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`Could not check the published ${file}. Please try again.`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(`Published ${file} is not a valid index.`);
  return data;
}
async function inspect(id) {
  const [story, titles, search] = await Promise.all([storyMeta(id), publicJSON('story-titles.json'), publicJSON('search.json')]);
  const url = storyPath(story);
  const oldTitle = titles.find(x => normalizeUrl(x.url) === normalizeUrl(url));
  const oldSearch = search.find(x => x.type !== 'category' && normalizeUrl(x.url) === normalizeUrl(url));
  return {id, title: story.title, url: SITE + url, updatedAt: story._updatedAt, ...classify(story, oldTitle, oldSearch), hostingReady: hostingReady()};
}
function hostingReady() {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY || fs.existsSync(path.join(os.homedir(), '.aws/credentials')) || process.env.AWS_PROFILE && fs.existsSync(path.join(os.homedir(), '.aws/config')));
}
async function storage() {
  config();
  if (!hostingReady()) throw new Error('Connect this Mac to the existing AWS hosting account before quick publishing. Publish Site still works through TakeShape.');
  return {client: new S3Client({region: process.env.AWS_REGION || 'us-east-1', followRegionRedirects: true}), bucket: 'www.awaylands.com'};
}
async function getPublicObject(key) {
  const url = key.endsWith('/index.html') ? key.slice(0, -10) : key;
  const response = await fetch(`${SITE}/${url}?postpreview=${Date.now()}`, {signal: AbortSignal.timeout(30000)});
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not read published ${key}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return {bytes, raw:bytes, etag:response.headers.get('etag'), contentType:response.headers.get('content-type')};
}
async function getObject(store, key) {
  try {
    const result = await store.client.send(new GetObjectCommand({Bucket: store.bucket, Key: key}));
    let bytes = Buffer.from(await result.Body.transformToByteArray());
    const raw = bytes;
    if (result.ContentEncoding === 'gzip' || bytes[0] === 31 && bytes[1] === 139) bytes = zlib.gunzipSync(bytes);
    const acl = await store.client.send(new GetObjectAclCommand({Bucket: store.bucket, Key: key}));
    const publicRead = (acl.Grants || []).some(grant => grant.Grantee?.URI === 'http://acs.amazonaws.com/groups/global/AllUsers' && grant.Permission === 'READ');
    return {bytes, raw, publicRead, etag: result.ETag, contentType: result.ContentType, encoding: result.ContentEncoding, cacheControl: result.CacheControl};
  } catch (error) { if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) return null; throw error; }
}
function mergeIndex(entries, replacement, url) {
  let matches = 0;
  const result = entries.map(item => {
    if (normalizeUrl(item.url) !== normalizeUrl(url)) return item;
    matches += 1;
    return replacement;
  });
  if (matches !== 1) throw new Error('The public index changed or contains duplicate post entries. Publish Site to reconcile it.');
  return result;
}
function sitemapUpdate(xml, url, date) {
  let count = 0;
  const result = xml.replace(/<url>[\s\S]*?<\/url>/g, block => {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (normalizeUrl(loc) !== normalizeUrl(url)) return block;
    count += 1;
    if (!/^\d{4}-\d{2}-\d{2}T[0-9:.+-]+Z?$/.test(date)) throw new Error('Invalid post modification date.');
    const lastmod = `<lastmod>${date}</lastmod>`;
    return /<lastmod>/.test(block) ? block.replace(/<lastmod>[^<]*<\/lastmod>/, lastmod) : block.replace('</url>', `${lastmod}</url>`);
  });
  if (count !== 1) throw new Error('The sitemap does not have one canonical entry for this post. Publish Site first.');
  return result;
}
function validateStory(html, assets, url) {
  if ((html.match(/scripts\.mediavine\.com\/tags\/away-lands\.js/g) || []).length !== 1) throw new Error('Mediavine wrapper validation failed.');
  for (const marker of ['story-article__body', 'story-mediavine-sidebar-atf', 'story-mediavine-sidebar-btf', 'content_selector', 'sidebar_atf_selector', 'sidebar_btf_selector']) if (!html.includes(marker)) throw new Error(`Story validation failed: ${marker}.`);
  for (const key of ['stylesheets/main.css', 'javascripts/main.js']) if (!html.includes(`/assets/${assets[key]}`)) throw new Error('The story asset references do not match production.');
  if (!html.includes(`href="${url}"`)) throw new Error('The canonical URL did not match this post.');
}
function photoCount(html) {
  const body = html.split('<div class="story-article__body"')[1]?.split('<footer class="story-article__footer"')[0];
  if (!body) throw new Error('Could not identify the published article body.');
  const parts = body.split('<img');
  return parts.slice(1).filter((part, i) => !/rewardstyle|rstyle\.me|shopstyle|shopltk|ltkcdn|liketk|on\.ltk\.com|amazon\.|amzn\.to|revolve\.com|rvlv\.me|skimresources|product-image|shop-the-edit|tracking|pixel/.test(parts[i].slice(-500) + part.split('>')[0])).length;
}
function legacyKeys(url) {
  const root = path.join(ROOT, 'build/story');
  return fs.readdirSync(root).filter(slug => /^[a-z0-9-]+$/.test(slug)).map(slug => `story/${slug}/index.html`).filter(key => {
    const file = path.join(ROOT, 'build', key);
    if (!fs.existsSync(file)) return false;
    const match = fs.readFileSync(file, 'utf8').match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/);
    return match && normalizeUrl(match[1]) === normalizeUrl(SITE + url) && key !== url.slice(1) + 'index.html';
  });
}
async function cloudIdle() {
  const data = await graphql(`query{siteDeployStatus(projectId:"${PROJECT}",siteId:"${SITE_ID}"){status message}}`, {}, true);
  const status = String(data.siteDeployStatus?.status || '').toLowerCase();
  if (/pending|queued|start|progress|build|publish|deploy|running/.test(status) && !/success|complete|done|idle|failed/.test(status)) throw new Error('TakeShape is already publishing the site. Wait for it to finish, then publish this post.');
}
function runBuild(job, configFile) {
  const result = spawnSync(NODE, [path.join(ROOT, 'node_modules/@takeshape/cli/dist/index.cjs'), 'build', '--file', configFile], {cwd: job, encoding: 'utf8', timeout: 180000, maxBuffer: 3 * 1024 * 1024});
  const output = (result.stdout || '') + (result.stderr || '');
  if (result.error || result.status !== 0 || !/Generated \d+ pages/.test(output)) throw new Error('TakeShape did not finish generating this post: ' + output.slice(-1600));
}
async function generate(id, story, job) {
  const [page, context] = await Promise.all([
    graphql(singleStoryQuery(read('src/templates/data/stories.graphql'), id)),
    graphql(read('src/templates/data/story.graphql'))
  ]);
  const search = await graphql(singleStoryQuery(read('src/templates/data/search.graphql'), id, 'story'));
  const titles = await graphql(singleStoryQuery(read('src/templates/data/story-titles.graphql'), id, 'story'));
  const templates = path.join(job, 'src/templates');
  fs.cpSync(path.join(ROOT, 'src/templates'), templates, {recursive: true});
  privateDirectory(path.join(job, 'build/assets'));
  fs.copyFileSync(path.join(ROOT, 'build/assets/manifest.json'), path.join(job, 'build/assets/manifest.json'));
  fs.copyFileSync(path.join(ROOT, '.takeshaperc'), path.join(job, '.takeshaperc'));
  fs.chmodSync(path.join(job, '.takeshaperc'), 0o600);
  const cfg = yaml.load(read('tsg.yml'));
  const originalRoutes = cfg.routes;
  cfg.staticPath = 'empty'; cfg.buildPath = 'generated';
  cfg.context.assets = '../../build/assets/manifest.json';
  privateDirectory(path.join(job, 'empty'));
  // Keep routing definitions for template links without rendering other routes.
  cfg.routes = Object.fromEntries(Object.entries(originalRoutes).map(([name, route]) => [name, {path: route.path, paginate: {property: '__unused'}}]));
  const url = storyPath(story);
  writeJSON(path.join(templates, 'data/publish-page.json'), {...context, page: page.page});
  cfg.routes.publishPost = {path: url, template: originalRoutes.story.template, context: 'data/publish-page.json'};
  const searchContext = {categories: {items: []}, stories1: {items: [search.story]}, stories2: {items: []}, stories3: {items: []}, stories4: {items: []}};
  // The feed template uses the final nonempty page to place JSON commas.
  searchContext.stories1.items = []; searchContext.stories4.items = [search.story];
  writeJSON(path.join(templates, 'data/publish-search.json'), searchContext);
  cfg.routes.publishSearch = {path: '/search-entry.json', template: originalRoutes.searchData.template, context: 'data/publish-search.json'};
  writeJSON(path.join(templates, 'data/publish-title.json'), {storyTitles1: {items: [titles.story]}, storyTitles2: {items: []}, storyTitles3: {items: []}, storyTitles4: {items: []}});
  cfg.routes.publishTitle = {path: '/title-entry.json', template: originalRoutes.storyTitles.template, context: 'data/publish-title.json'};
  fs.writeFileSync(path.join(job, 'publish.yml'), yaml.dump(cfg), {mode: 0o600});
  runBuild(job, 'publish.yml');
  const html = fs.readFileSync(path.join(job, 'generated', url, 'index.html'), 'utf8');
  validateStory(html, manifest(), SITE + url);
  return {html, search: JSON.parse(fs.readFileSync(path.join(job, 'generated/search-entry.json')))[0], title: JSON.parse(fs.readFileSync(path.join(job, 'generated/title-entry.json')))[0]};
}
async function publishStory(id, options = {}) {
  if (!uuid(id)) throw new Error('Invalid post identifier.');
  privateDirectory(STATE);
  const lockPath = path.join(STATE, 'publish.lock');
  let lock;
  try { lock = fs.openSync(lockPath, 'wx', 0o600); } catch { throw new Error('Another local publish is running. Wait for it to finish.'); }
  const job = path.join(STATE, crypto.randomUUID());
  privateDirectory(job);
  const say = options.progress || (message => process.stdout.write(message + '\n'));
  const started = Date.now();
  let store;
  try {
    execFileSync(NODE, [path.join(ROOT, 'scripts/verify-production-baseline.js')], {cwd: ROOT, stdio: 'pipe'});
    await cloudIdle();
    say('Checking the saved post and public indexes...');
    const story = await storyMeta(id);
    if (options.expectedUpdatedAt && story._updatedAt !== options.expectedUpdatedAt) throw new Error('The saved post changed after this preview. Check it again before publishing.');
    const url = storyPath(story);
    if (!options.dryRun) store = await storage();
    const keys = [url.slice(1) + 'index.html', 'search.json', 'story-titles.json', 'sitemap.xml', ...legacyKeys(url)];
    const objects = await Promise.all(keys.map(key => options.dryRun ? getPublicObject(key) : getObject(store, key)));
    if (objects.some(x => !x)) throw new Error('This post or its public indexes are missing. Use Publish Site for the first publication.');
    const searches = JSON.parse(objects[1].bytes); const titles = JSON.parse(objects[2].bytes);
    const oldTitle = titles.find(x => normalizeUrl(x.url) === normalizeUrl(url));
    const oldSearch = searches.find(x => x.type !== 'category' && normalizeUrl(x.url) === normalizeUrl(url));
    const plan = classify(story, oldTitle, oldSearch);
    if (plan.mode !== 'post') throw new Error('Publish Site is needed: ' + plan.reasons.join(' '));
    const assets = manifest();
    // Refuse to publish local templates with assets differing from the live site.
    for (const asset of [assets['stylesheets/main.css'], assets['javascripts/main.js']]) {
      if (!objects[0].bytes.includes(Buffer.from('/assets/' + asset))) throw new Error('Live and local site versions differ. Publish Site before using the quick publisher.');
    }
    say('Building this post and its search entry...');
    const output = await generate(id, story, job);
    if ((await storyMeta(id))._updatedAt !== story._updatedAt) throw new Error('The post was edited during publishing. Nothing was uploaded; try again.');
    if ((story.location?.length || story.continent?.length) && photoCount(objects[0].bytes.toString()) !== photoCount(output.html)) throw new Error('The article photo count changed. Publish Site to update destination photo totals as well.');
    const marker = `<!-- awaylands-post-publish:${path.basename(job)} -->`;
    const payloads = [Buffer.from(output.html + '\n' + marker), Buffer.from(JSON.stringify(mergeIndex(searches, output.search, url))), Buffer.from(JSON.stringify(mergeIndex(titles, output.title, url))), Buffer.from(sitemapUpdate(objects[3].bytes.toString(), SITE + url, story._updatedAt))];
    for (let i = 4; i < keys.length; i++) {
      if (!objects[i].bytes.toString().includes(`href="${SITE + url}"`)) throw new Error('A legacy URL no longer belongs to this post. Publish Site first.');
      payloads.push(payloads[0]);
    }
    writeJSON(path.join(job, 'plan.json'), {id, url, updatedAt: story._updatedAt, keys, mode: 'post'});
    for (let i = 0; i < keys.length; i++) {
      fs.writeFileSync(path.join(job, `before-${i}`), objects[i].raw, {mode: 0o600});
      fs.writeFileSync(path.join(job, `after-${i}`), payloads[i], {mode: 0o600});
    }
    if (options.dryRun) return {status: 'validated', url: SITE + url, seconds: (Date.now() - started) / 1000, files: keys, job};
    await cloudIdle();
    say('Publishing the article and updating search...');
    const uploaded = [];
    try {
      // Conditional writes detect concurrent publishes instead of overwriting them.
      for (let i = 0; i < keys.length; i++) {
        const result = await store.client.send(new PutObjectCommand({Bucket: store.bucket, Key: keys[i], Body: payloads[i], ACL: objects[i].publicRead ? 'public-read' : undefined, ContentType: objects[i].contentType || (keys[i].endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8'), CacheControl: 'public, max-age=0, must-revalidate', IfMatch: objects[i].etag}));
        uploaded.push({i, etag: result.ETag});
      }
    } catch (error) {
      const rollbackFailures = [];
      for (const {i, etag} of uploaded.reverse()) {
        try { await store.client.send(new PutObjectCommand({Bucket: store.bucket, Key: keys[i], Body: objects[i].raw, ACL: objects[i].publicRead ? 'public-read' : undefined, ContentType: objects[i].contentType, ContentEncoding: objects[i].encoding, CacheControl: objects[i].cacheControl, IfMatch: etag})); } catch { rollbackFailures.push(keys[i]); }
      }
      throw new Error(rollbackFailures.length ? `Publishing stopped; some files need recovery: ${rollbackFailures.join(', ')}. Backups: ${job}` : 'Publishing stopped because a file changed or hosting rejected the update. Earlier writes were restored. Try again after other publishes finish.');
    }
    say('Checking the live article...');
    let visible = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const response = await fetch(SITE + url + '?postpublish=' + path.basename(job), {signal: AbortSignal.timeout(10000), cache: 'no-store'});
        if (response.ok && (await response.text()).includes(marker)) { visible = true; break; }
      } catch {}
      if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 2000));
    }
    const result = {status: visible ? 'published' : 'uploaded', url: SITE + url, seconds: (Date.now() - started) / 1000, files: keys, job, message: visible ? 'Post published and verified live.' : 'Uploaded to hosting. The public cache has not refreshed yet; do not republish repeatedly.'};
    writeJSON(path.join(job, 'result.json'), result);
    return result;
  } finally {
    store?.client.destroy();
    // Never retain copies of the CMS credential in job artifacts.
    fs.rmSync(path.join(job, '.takeshaperc'), {force: true});
    if (lock !== undefined) { fs.closeSync(lock); fs.rmSync(lockPath, {force: true}); }
  }
}

module.exports = {inspect, publishStory, singleStoryQuery, classify, storyPath, mergeIndex, sitemapUpdate, validateStory, uuid, hostingReady};
