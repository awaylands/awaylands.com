const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const ASSET_DIR = path.join(BUILD_DIR, 'assets', 'google-doc-images');
const PUBLIC_ASSET_PATH = '/assets/google-doc-images';
const MAX_REDIRECTS = 5;

const REMOTE_GOOGLE_IMAGE_RE = /(?:https?:)?\/\/[^"' <>)\\]+(?:googleusercontent\.com|docs\.google\.com)[^"' <>)\\]*/gi;
const DATA_IMAGE_RE = /data:image\/([a-z0-9.+-]+);base64,([a-z0-9+/=]+)/gi;

function walk(dir, files) {
  fs.readdirSync(dir).forEach(name => {
    const filePath = path.join(dir, name);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (filePath !== ASSET_DIR) {
        walk(filePath, files);
      }
      return;
    }

    if (/\.(html|json)$/i.test(name)) {
      files.push(filePath);
    }
  });
}

function normalizeRemoteUrl(rawUrl) {
  let url = rawUrl.replace(/&amp;/g, '&');

  if (url.indexOf('//') === 0) {
    url = `https:${url}`;
  }

  return url;
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function extensionForContentType(contentType) {
  if (!contentType) {
    return 'jpg';
  }

  if (contentType.indexOf('png') !== -1) {
    return 'png';
  }

  if (contentType.indexOf('gif') !== -1) {
    return 'gif';
  }

  if (contentType.indexOf('webp') !== -1) {
    return 'webp';
  }

  if (contentType.indexOf('svg') !== -1) {
    return 'svg';
  }

  return 'jpg';
}

function isImageContentType(contentType) {
  return /^image\//i.test(contentType || '');
}

function extensionForDataType(type) {
  if (type === 'jpeg') {
    return 'jpg';
  }

  if (/^[a-z0-9]+$/i.test(type)) {
    return type;
  }

  return 'jpg';
}

function requestBuffer(url, redirects) {
  return new Promise((resolve, reject) => {
    const client = url.indexOf('https:') === 0 ? https : http;

    client.get(url, response => {
      const statusCode = response.statusCode || 0;
      const location = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location && redirects < MAX_REDIRECTS) {
        response.resume();
        resolve(requestBuffer(new URL(location, url).toString(), redirects + 1));
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`HTTP ${statusCode}`));
        return;
      }

      const chunks = [];

      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: response.headers['content-type'] || ''
        });
      });
    }).on('error', reject);
  });
}

async function localizeRemoteImage(rawUrl, cache) {
  const url = normalizeRemoteUrl(rawUrl);

  if (cache[url]) {
    return cache[url];
  }

  const result = await requestBuffer(url, 0);

  if (!isImageContentType(result.contentType)) {
    throw new Error(`Expected image response, got ${result.contentType || 'unknown content type'}`);
  }

  const ext = extensionForContentType(result.contentType);
  const filename = `${hash(url)}.${ext}`;
  const outputPath = path.join(ASSET_DIR, filename);

  fs.writeFileSync(outputPath, result.buffer);

  cache[url] = `${PUBLIC_ASSET_PATH}/${filename}`;
  return cache[url];
}

function localizeDataImage(type, data, cache) {
  const key = `${type}:${data}`;

  if (cache[key]) {
    return cache[key];
  }

  const ext = extensionForDataType(type.toLowerCase());
  const filename = `${hash(key)}.${ext}`;
  const outputPath = path.join(ASSET_DIR, filename);

  fs.writeFileSync(outputPath, Buffer.from(data, 'base64'));

  cache[key] = `${PUBLIC_ASSET_PATH}/${filename}`;
  return cache[key];
}

async function main() {
  if (!fs.existsSync(BUILD_DIR)) {
    console.log('No build directory found; skipping Google Docs image localization.');
    return;
  }

  fs.mkdirSync(ASSET_DIR, {recursive: true});

  const files = [];
  const remoteCache = {};
  const dataCache = {};
  let localizedCount = 0;

  walk(BUILD_DIR, files);

  for (const filePath of files) {
    let source = fs.readFileSync(filePath, 'utf8');
    let output = source;
    const remoteMatches = source.match(REMOTE_GOOGLE_IMAGE_RE) || [];
    let localizedRemoteCount = 0;

    for (const rawUrl of remoteMatches) {
      try {
        const localUrl = await localizeRemoteImage(rawUrl, remoteCache);
        output = output.split(rawUrl).join(localUrl);
        localizedRemoteCount += 1;
      } catch (error) {
        console.warn(`Could not localize ${rawUrl} in ${path.relative(BUILD_DIR, filePath)}: ${error.message}`);
      }
    }

    output = output.replace(DATA_IMAGE_RE, (match, type, data) => {
      localizedCount += 1;
      return localizeDataImage(type, data, dataCache);
    });

    if (output !== source) {
      localizedCount += localizedRemoteCount;
      fs.writeFileSync(filePath, output);
    }
  }

  console.log(`Localized ${localizedCount} pasted image reference${localizedCount === 1 ? '' : 's'}.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
