const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, '.takeshaperc'), 'utf8'));
const port = Number(process.env.PORT || 5057);
const branch = process.env.TS_BRANCH || 'production';
const branchKind = branch === 'production' ? 'production' : `development/${encodeURIComponent(branch)}`;
const graphqlUrl = `${config.endpoint}/project/${config.projectId}/${branchKind}/graphql`;
const pagePath = path.join(__dirname, 'story-importer.html');
const maxBodySize = 16 * 1024 * 1024;

function jsonResponse(response, status, data) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(data));
}

function requestJson(url, options, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = https.request({
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      method: options.method || 'POST',
      headers: options.headers || {}
    }, response => {
      const chunks = [];

      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');

        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`TakeShape returned HTTP ${response.statusCode}: ${text.slice(0, 500)}`));
          return;
        }

        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(new Error(`TakeShape returned invalid JSON: ${text.slice(0, 500)}`));
        }
      });
    });

    request.on('error', reject);
    request.end(body);
  });
}

function graphql(query, variables) {
  const body = JSON.stringify({query, variables});

  return requestJson(graphqlUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.linkedApiKey.apiKey}`,
      'Content-Length': Buffer.byteLength(body),
      'Content-Type': 'application/json'
    }
  }, body).then(result => {
    if (result.errors && result.errors.length) {
      throw new Error(result.errors.map(error => error.message).join('\n'));
    }

    return result.data;
  });
}

function putBuffer(url, buffer, type) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = https.request({
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      method: 'PUT',
      headers: {
        'Content-Length': buffer.length,
        'Content-Type': type
      }
    }, response => {
      response.resume();

      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`Image upload returned HTTP ${response.statusCode}`));
        return;
      }

      response.on('end', resolve);
    });

    request.on('error', reject);
    request.end(buffer);
  });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on('data', chunk => {
      size += chunk.length;

      if (size > maxBodySize) {
        reject(new Error('Paste payload is too large. Try pasting the post in two sections.'));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(new Error('The importer received invalid data.'));
      }
    });

    request.on('error', reject);
  });
}

async function uploadImage(input) {
  const match = String(input.dataUrl || '').match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i);

  if (!match) {
    throw new Error('The pasted image data is not valid.');
  }

  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  const filename = String(input.filename || 'google-doc-image.jpg').replace(/[^a-z0-9._-]+/gi, '-');
  const data = await graphql(`
    mutation UploadStoryImage($files: [TSFile]!) {
      uploadAssets(files: $files) {
        uploadUrl
        asset {
          _id
          path
          filename
        }
      }
    }
  `, {files: [{name: filename, type: mimeType}]});
  const upload = data.uploadAssets && data.uploadAssets[0];

  if (!upload || !upload.uploadUrl || !upload.asset) {
    throw new Error('TakeShape did not return an image upload destination.');
  }

  await putBuffer(upload.uploadUrl, buffer, mimeType);
  return upload.asset;
}

async function createStory(input) {
  const storyInput = {
    title: String(input.title || '').trim(),
    slug: String(input.slug || '').trim(),
    content: input.content,
    contentBlocks: [],
    tout: input.heroAssetId ? {image: {id: input.heroAssetId}} : {},
    social: {},
    _status: 'enabled'
  };

  if (input.postType) {
    storyInput.postType = input.postType;
  }

  if (input.pageLayout) {
    storyInput.pageLayout = input.pageLayout;
  }

  const data = await graphql(`
    mutation ImportStory($input: CreateStoryInput!) {
      createStory(input: $input) {
        result {
          _id
          title
          slug
          _status
        }
      }
    }
  `, {input: storyInput});

  return data.createStory.result;
}

http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);

  try {
    if (request.method === 'GET' && requestUrl.pathname === '/') {
      const page = fs.readFileSync(pagePath, 'utf8')
        .replace(/__TAKESHAPE_BRANCH__/g, branch)
        .replace(/__TAKESHAPE_PROJECT__/g, config.projectName || 'TakeShape');

      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/html; charset=utf-8'
      });
      response.end(page);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/upload-image') {
      jsonResponse(response, 200, {asset: await uploadImage(await readJson(request))});
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/create-story') {
      jsonResponse(response, 200, {story: await createStory(await readJson(request))});
      return;
    }

    jsonResponse(response, 404, {error: 'Not found'});
  } catch (error) {
    jsonResponse(response, 400, {error: error.message});
  }
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Post Importer for ${config.projectName} (${branch}): http://127.0.0.1:${port}/\n`);
});
