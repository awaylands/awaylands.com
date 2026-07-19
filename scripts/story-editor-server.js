const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, '.takeshaperc'), 'utf8'));
const port = Number(process.env.PORT || 5058);
const branch = process.env.TS_BRANCH || 'production';
const branchKind = branch === 'production' ? 'production' : `development/${encodeURIComponent(branch)}`;
const graphqlUrl = `${config.endpoint}/project/${config.projectId}/${branchKind}/graphql`;
const pagePath = path.join(__dirname, 'story-editor.html');
const maxBodySize = 24 * 1024 * 1024;

function respond(response, status, data, type) {
  response.writeHead(status, {'Cache-Control': 'no-store', 'Content-Type': type || 'application/json; charset=utf-8'});
  response.end(type ? data : JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > maxBodySize) {
        reject(new Error('The request is too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (error) { reject(new Error('Invalid request data.')); }
    });
    request.on('error', reject);
  });
}

function requestJson(url, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = https.request({
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.linkedApiKey.apiKey}`,
        'Content-Length': Buffer.byteLength(body),
        'Content-Type': 'application/json'
      }
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(`TakeShape returned HTTP ${response.statusCode}.`));
        try { resolve(JSON.parse(text)); }
        catch (error) { reject(new Error('TakeShape returned invalid data.')); }
      });
    });
    request.on('error', reject);
    request.end(body);
  });
}

async function graphql(query, variables) {
  const result = await requestJson(graphqlUrl, JSON.stringify({query, variables}));
  if (result.errors && result.errors.length) throw new Error(result.errors.map(error => error.message).join('\n'));
  return result.data;
}

const storySummary = `_id title slug publishedDate postType pageLayout _status _version _updatedAt`;

async function listStories(terms) {
  const data = await graphql(`query StoryEditorList($terms: String) {
    getStoryList(size: 200, terms: $terms, sort: [{field: "_updatedAt", order: "desc"}]) {
      total items { ${storySummary} }
    }
  }`, {terms: terms || undefined});
  return data.getStoryList;
}

async function getStory(id) {
  const data = await graphql(`query StoryEditorDetail($id: ID!) {
    getStory(_id: $id) {
      ${storySummary}
      content
      contentBlocks {
        __typename
        ... on ContentBlock { content }
        ... on HtmlBlock { label html }
        ... on TableBlock { pastedText columnCount }
        ... on StoryImageBlock {
          label size alignment spacing caption linkUrl
          image { _id path filename title description mimeType }
        }
        ... on StoryGalleryBlock {
          label layout size
          images { caption altText linkUrl image { _id path filename title description mimeType } }
        }
      }
      shopEditEnabled shopEditTitle
      keepReadingKicker keepReadingTitle
      mainHtmlBlock1 mainContentBlock1
      mainHtmlBlock2 mainContentBlock2
      mainHtmlBlock3 mainContentBlock3
      mainHtmlBlock4 mainContentBlock4
      mainHtmlBlock5 mainContentBlock5
      mainHtmlBlock6 mainContentBlock6
      relatedStories { _id title slug _status }
    }
  }`, {id});
  return data.getStory;
}

async function listAssets(terms) {
  const data = await graphql(`query StoryEditorAssets($terms: String) {
    getAssetList(size: 80, terms: $terms, sort: [{field: "_createdAt", order: "desc"}]) {
      total items { _id path filename title description mimeType _createdAt }
    }
  }`, {terms: terms || undefined});
  return data.getAssetList;
}

function allowedStoryInput(input, creating) {
  const allowed = ['title', 'slug', 'publishedDate', 'postType', 'pageLayout', 'content', 'contentBlocks', 'shopEditEnabled', 'shopEditTitle', 'keepReadingKicker', 'keepReadingTitle', 'mainHtmlBlock1', 'mainContentBlock1', 'mainHtmlBlock2', 'mainContentBlock2', 'mainHtmlBlock3', 'mainContentBlock3', 'mainHtmlBlock4', 'mainContentBlock4', 'mainHtmlBlock5', 'mainContentBlock5', 'mainHtmlBlock6', 'mainContentBlock6'];
  const clean = {};
  allowed.forEach(key => { if (Object.prototype.hasOwnProperty.call(input, key)) clean[key] = input[key]; });
  if (creating) {
    clean.tout = {};
    clean.social = {};
    clean.contentBlocks = [];
    clean._status = input.publish ? 'enabled' : 'disabled';
  } else {
    clean._id = input._id;
    clean._version = input._version;
    if (input.publish === true) clean._status = 'enabled';
    if (input.publish === false) clean._status = 'disabled';
  }
  return clean;
}

async function saveStory(input) {
  if (!input.title || !String(input.title).trim()) throw new Error('A title is required.');
  if (!input.content || !Array.isArray(input.content.blocks)) throw new Error('Story content is invalid.');
  if (input._id) {
    const data = await graphql(`mutation StoryEditorUpdate($input: UpdateStoryInput!) {
      updateStory(input: $input) { result { ${storySummary} } }
    }`, {input: allowedStoryInput(input, false)});
    return data.updateStory.result;
  }
  const data = await graphql(`mutation StoryEditorCreate($input: CreateStoryInput!) {
    createStory(input: $input) { result { ${storySummary} } }
  }`, {input: allowedStoryInput(input, true)});
  return data.createStory.result;
}

http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
  try {
    if (request.method === 'GET' && requestUrl.pathname === '/') {
      const page = fs.readFileSync(pagePath, 'utf8')
        .replace(/__TAKESHAPE_BRANCH__/g, branch)
        .replace(/__TAKESHAPE_PROJECT__/g, config.projectName || 'TakeShape');
      respond(response, 200, page, 'text/html; charset=utf-8');
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/api/stories') {
      respond(response, 200, await listStories(requestUrl.searchParams.get('q')));
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname.startsWith('/api/stories/')) {
      respond(response, 200, {story: await getStory(decodeURIComponent(requestUrl.pathname.slice(13)))});
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/api/assets') {
      respond(response, 200, await listAssets(requestUrl.searchParams.get('q')));
      return;
    }
    if (request.method === 'POST' && requestUrl.pathname === '/api/stories') {
      respond(response, 200, {story: await saveStory(await readJson(request))});
      return;
    }
    respond(response, 404, {error: 'Not found'});
  } catch (error) {
    respond(response, 400, {error: error.message});
  }
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Away Lands Story Editor (${branch}): http://127.0.0.1:${port}/\n`);
});
