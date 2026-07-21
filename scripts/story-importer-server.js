const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const Jimp = require('jimp');

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

function isAllowedGoogleImageUrl(value) {
  try {
    const target = new URL(String(value || ''));

    return target.protocol === 'https:' && /(^|\.)(googleusercontent\.com|docs\.google\.com)$/i.test(target.hostname);
  } catch (error) {
    return false;
  }
}

function downloadGoogleImage(url, redirects) {
  return new Promise((resolve, reject) => {
    if (!isAllowedGoogleImageUrl(url)) {
      reject(new Error('A pasted image URL was not a supported Google Docs image.'));
      return;
    }

    const target = new URL(url);
    const request = https.get({
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      headers: {'User-Agent': 'Mozilla/5.0 Away Lands Google Docs Importer'}
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if ((redirects || 0) >= 4) {
          reject(new Error('A Google Docs image redirected too many times.'));
          return;
        }
        const nextUrl = new URL(response.headers.location, target).toString();
        downloadGoogleImage(nextUrl, (redirects || 0) + 1).then(resolve, reject);
        return;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`A Google Docs image returned HTTP ${response.statusCode}.`));
        return;
      }

      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 20 * 1024 * 1024) {
          request.destroy(new Error('A Google Docs image exceeded the 20 MB import limit.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });

    request.on('error', reject);
  });
}

function optimizeImage(buffer) {
  return Jimp.read(buffer).then(image => {
    const maxEdge = 1800;
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    if (Math.max(width, height) > maxEdge) {
      if (width >= height) image.resize(maxEdge, Jimp.AUTO);
      else image.resize(Jimp.AUTO, maxEdge);
    }
    image.background(0xffffffff);
    image.quality(78);

    return new Promise((resolve, reject) => {
      image.getBuffer(Jimp.MIME_JPEG, (error, output) => {
        if (error) reject(error);
        else resolve(output);
      });
    });
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

  if (!match && !isAllowedGoogleImageUrl(input.sourceUrl)) {
    throw new Error('The pasted image data is not valid.');
  }

  const mimeType = 'image/jpeg';
  const sourceBuffer = match ? Buffer.from(match[2], 'base64') : await downloadGoogleImage(input.sourceUrl);
  const buffer = await optimizeImage(sourceBuffer);
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
    contentBlocks: Array.isArray(input.contentBlocks) ? input.contentBlocks : [],
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

  const serializedInput = JSON.stringify(storyInput);

  if (/data:image\//i.test(serializedInput)) {
    throw new Error('An embedded Google Docs image remained in the story payload. The import was stopped before GraphQL so the story item would not be oversized.');
  }
  if (Buffer.byteLength(serializedInput) > 350 * 1024) {
    throw new Error('The finished story content exceeds 350 KB after image removal. Split the article into additional Content blocks before importing.');
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
