const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const {preparePublishInput} = require('./prepare-publish-input');
const yaml = require('js-yaml');
const {sourceFingerprint, recordBuild, verifyBuild} = require('./verified-build');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bundledNode = '/Users/amyseder/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node';
const configuredNode = process.env.AWAYLANDS_NODE;
const node = configuredNode && fs.existsSync(configuredNode)
  ? configuredNode
  : (fs.existsSync(bundledNode) ? bundledNode : process.execPath);
const takeShape = path.join(root, 'node_modules/@takeshape/cli/dist/index.cjs');
const npmCli = process.env.npm_execpath || '/usr/local/lib/node_modules/npm/bin/npm-cli.js';
const manifestPath = path.join(root, 'build/assets/manifest.json');

function run(command, args) {
  childProcess.execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: `${path.dirname(node)}:${process.env.PATH || ''}`
    }
  });
}

function fail(message) {
  throw new Error(`Deployment stopped: ${message}`);
}

function walk(dir, files = []) {
  fs.readdirSync(dir).forEach(name => {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) walk(file, files);
    else files.push(file);
  });
  return files;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyTree(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  fs.readdirSync(source).forEach(name => {
    const from = path.join(source, name);
    const to = path.join(destination, name);
    if (fs.statSync(from).isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  });
}

function removeTree(directory) {
  if (!fs.existsSync(directory)) return;
  fs.readdirSync(directory).forEach(name => {
    const file = path.join(directory, name);
    if (fs.statSync(file).isDirectory()) removeTree(file);
    else fs.unlinkSync(file);
  });
  fs.rmdirSync(directory);
}

function clearDirectory(directory) {
  fs.readdirSync(directory).forEach(name => {
    const file = path.join(directory, name);
    if (fs.statSync(file).isDirectory()) removeTree(file);
    else fs.unlinkSync(file);
  });
}

function getManifestAssets() {
  if (!fs.existsSync(manifestPath)) fail('build/assets/manifest.json is missing.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const css = manifest['stylesheets/main.css'];
  const js = manifest['javascripts/main.js'];
  if (!css || !js) fail('the build manifest is missing the main CSS or JavaScript asset.');
  [css, js].forEach(asset => {
    if (!/^(javascripts|stylesheets)\/main\.[^/]+\.(js|css)$/.test(asset)) {
      fail(`manifest asset is not hashed: ${asset}`);
    }
    if (!fs.existsSync(path.join(root, 'build/assets', asset))) {
      fail(`manifest asset is missing from build/assets: ${asset}`);
    }
  });
  return { css, js };
}

function verifyGeneratedHtml(assets) {
  const htmlFiles = walk(path.join(root, 'build')).filter(file => file.endsWith('.html'));
  if (!htmlFiles.length) fail('the generated build contains no HTML pages.');
  const cssHref = `/assets/${assets.css}`;
  const jsSrc = `/assets/${assets.js}`;
  let checked = 0;
  htmlFiles.forEach(file => {
    const html = fs.readFileSync(file, 'utf8');
    const isRedirect = /<meta[^>]+http-equiv=["']refresh["']/i.test(html);
    const cssReferences = html.match(/\/assets\/stylesheets\/main\.[^"'\s?]+\.css/g) || [];
    const jsReferences = html.match(/\/assets\/javascripts\/main\.[^"'\s?]+\.js/g) || [];
    if (isRedirect && !cssReferences.length && !jsReferences.length) {
      return;
    }
    checked += 1;
    if (cssReferences.length !== 1 || cssReferences[0] !== cssHref) fail(`generated HTML references a stale or duplicate stylesheet: ${path.relative(root, file)}`);
    if (jsReferences.length !== 1 || jsReferences[0] !== jsSrc) fail(`generated HTML references stale or duplicate JavaScript: ${path.relative(root, file)}`);
  });
  if (!checked) fail('no generated HTML documents contained a head stylesheet reference.');
}

function normalizeGeneratedAssets(assets) {
  const htmlFiles = walk(path.join(root, 'build')).filter(file => file.endsWith('.html'));
  htmlFiles.forEach(file => {
    const original = fs.readFileSync(file, 'utf8');
    const normalized = original
      .replace(/\/assets\/stylesheets\/main\.[^"'?\s]+\.css/g, `/assets/${assets.css}`)
      .replace(/\/assets\/javascripts\/main\.[^"'?\s]+\.js/g, `/assets/${assets.js}`)
      .replace(new RegExp(`(/assets/${assets.css.replace('.', '\\.')})\\?[^"'\\s]+`, 'g'), '$1');
    if (normalized !== original) fs.writeFileSync(file, normalized);
  });
}

async function fetch(url) {
  const response = await globalThis.fetch(url, {
    headers: {'user-agent':'awaylands-production-verifier'},
    signal: AbortSignal.timeout(20000)
  });
  return {status:response.status, body:await response.text()};
}

async function parallelChecks(items, check) {
  let next = 0;
  const results = await Promise.allSettled(Array.from({length: Math.min(4, items.length)}, async () => {
    while (next < items.length) await check(items[next++]);
  }));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
}

async function verifyLiveOnce(assets) {
  const cacheBust = `codexverify=${Date.now()}`;
  const pages = [
    '/',
    '/blog/',
    '/category/home-and-garden/',
    '/category/travel-style/',
    '/category/wedding-and-honeymoon/',
    '/destinations/thailand/',
    '/continent/asia/',
    '/destinations/greece/archive/',
    '/film/',
    '/still/',
    '/story/how-to-stay-healthy-while-traveling-12-easy-habits-that-work-on-the-road/'
  ];
  const expectedCss = `/assets/${assets.css}`;
  const expectedJs = `/assets/${assets.js}`;
  const localCssHash = sha256(path.join(root, 'build/assets', assets.css));
  const localJsHash = sha256(path.join(root, 'build/assets', assets.js));
  const release = yaml.load(fs.readFileSync(path.join(root, 'tsg.yml'), 'utf8')).context.publishingRelease;
  await parallelChecks(pages, async page => {
    const result = await fetch(`https://www.awaylands.com${page}?${cacheBust}`);
    if (result.status !== 200) fail(`${page} returned HTTP ${result.status}.`);
    if (!result.body.includes(`name="awaylands-publishing-release" content="${release}"`)) fail(`${page} has not received publishing release ${release}.`);
    const adCount = (result.body.match(/scripts\.mediavine\.com\/tags\/away-lands\.js/g) || []).length;
    if (/^\/(film|still)\//.test(page) && adCount !== 0) fail(`Advertising must not load on ${page}.`);
    if (page.startsWith('/story/')) {
      if (adCount !== 1) fail('Story advertising wrapper is missing or duplicated.');
      for (const marker of ['story-article__body','story-mediavine-sidebar-atf','story-mediavine-sidebar-btf','content_selector','sidebar_atf_selector','sidebar_btf_selector']) {
        if (!result.body.includes(marker)) fail(`Live story is missing ${marker}.`);
      }
    }
    const matches = result.body.match(/\/assets\/stylesheets\/main\.[^"'\s?]+\.css(?:\?[^"'\s]*)?/g) || [];
    if (!matches.includes(expectedCss)) {
      const found = matches[0] || 'no stylesheet';
      fail(`${page} serves ${found}; expected ${expectedCss}.`);
    }
    const jsMatches = result.body.match(/\/assets\/javascripts\/main\.[^"'\s?]+\.js(?:\?[^"'\s]*)?/g) || [];
    if (!jsMatches.includes(expectedJs)) {
      const found = jsMatches[0] || 'no JavaScript bundle';
      fail(`${page} serves ${found}; expected ${expectedJs}.`);
    }
  });
  const css = await fetch(`https://www.awaylands.com${expectedCss}?${cacheBust}`);
  if (css.status !== 200) fail(`${expectedCss} returned HTTP ${css.status}.`);
  const liveCssHash = crypto.createHash('sha256').update(css.body).digest('hex');
  if (liveCssHash !== localCssHash) {
    fail(`${expectedCss} checksum mismatch (live ${liveCssHash}, local ${localCssHash}).`);
  }
  const js = await fetch(`https://www.awaylands.com${expectedJs}?${cacheBust}`);
  if (js.status !== 200) fail(`${expectedJs} returned HTTP ${js.status}.`);
  const liveJsHash = crypto.createHash('sha256').update(js.body).digest('hex');
  if (liveJsHash !== localJsHash) {
    fail(`${expectedJs} checksum mismatch (live ${liveJsHash}, local ${localJsHash}).`);
  }
  process.stdout.write(`Deployment verified live: ${assets.css}\n`);
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function verifyLive(assets) {
  const maximumAttempts = 18;
  let lastError;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      await verifyLiveOnce(assets);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === maximumAttempts) {
        break;
      }
      process.stdout.write(`Live verification attempt ${attempt}: ${error.message}\n`);
      await wait(5000);
    }
  }

  throw lastError;
}

function generateSite() {
  const configPath = path.join(root, '.tsg-production-build.yml');
  const generatedPath = path.join(root, '.deploy-generated');
  const staticPath = path.join(root, '.deploy-static');
  const assetBackupPath = path.join(root, '.deploy-assets');
  const config = fs.readFileSync(path.join(root, 'tsg.yml'), 'utf8')
    .replace(/^buildPath:\s*build\s*$/m, 'buildPath: .deploy-generated')
    .replace(/^staticPath:\s*publish-static\s*$/m, 'staticPath: .deploy-static');
  fs.writeFileSync(configPath, config);
  try {
    removeTree(assetBackupPath);
    copyTree(path.join(root, 'build/assets'), assetBackupPath);
    copyTree(path.join(root, 'build/assets'), path.join(staticPath, 'assets'));
    run(node, [takeShape, 'build', '--file', '.tsg-production-build.yml']);
    clearDirectory(path.join(root, 'build'));
    copyTree(generatedPath, path.join(root, 'build'));
    copyTree(assetBackupPath, path.join(root, 'build/assets'));
    run(node, [path.join(root, 'scripts/generate-destination-route-aliases.js')]);
    run(node, [path.join(root, 'scripts/generate-category-route-aliases.js')]);
    run(node, [path.join(root, 'scripts/normalize-generated-html.js')]);
  } finally {
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    removeTree(generatedPath);
    removeTree(staticPath);
    removeTree(assetBackupPath);
  }
}

async function main() {
  const postIndex = process.argv.indexOf('--post');
  if (postIndex !== -1) {
    const {publishStory} = require('./publish-post');
    const result = await publishStory(process.argv[postIndex + 1], {dryRun: process.argv.includes('--dry-run')});
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }
  let assets;
  if (process.argv.includes('--publish-verified')) {
    verifyBuild(root);
    assets = getManifestAssets();
    verifyGeneratedHtml(assets);
    preparePublishInput();
    process.stdout.write('Reusing the unchanged, verified production build.\n');
  } else {
    const source = sourceFingerprint(root);
    run(node, [npmCli, 'run', 'build']);
    const builtAssets = getManifestAssets();
    preparePublishInput(false);
    generateSite();
    assets = getManifestAssets();
    if (assets.css !== builtAssets.css || assets.js !== builtAssets.js) fail('site generation changed the compiled manifest.');
    normalizeGeneratedAssets(assets);
    verifyGeneratedHtml(assets);
    preparePublishInput();
    recordBuild(root, source);
  }
  if (process.argv.includes('--generate-only')) {
    process.stdout.write('Production-equivalent site generated and verified locally.\n');
    return;
  }
  run(node, [path.join(root, 'scripts/verify-production-baseline.js')]);
  const started = Date.now();
  run(node, [takeShape, 'deploy', '--file', 'tsg.yml']);
  await verifyLive(assets);
  process.stdout.write(`Upload and live verification completed in ${((Date.now()-started)/1000).toFixed(1)} seconds.\n`);
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
