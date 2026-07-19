const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(__dirname, '..', 'build');
const port = Number(process.env.PORT || 5056);
const aliases = {
  '/post1': '/story/when-should-your-child-get-their-first-phone/',
  '/post1/': '/story/when-should-your-child-get-their-first-phone/',
  '/post2': '/story/when-should-your-child-get-their-first-phone/',
  '/post2/': '/story/when-should-your-child-get-their-first-phone/',
  '/post3': '/story/best-travel-photography-cameras-and-gear-from-a-professional-photographer/',
  '/post3/': '/story/best-travel-photography-cameras-and-gear-from-a-professional-photographer/',
  '/post4': '/story/what-to-wear-in-the-south-of-france-30-outfit-ideas-for-provence-and-french-riviera-summer-style/',
  '/post4/': '/story/what-to-wear-in-the-south-of-france-30-outfit-ideas-for-provence-and-french-riviera-summer-style/'
};
const redirects = {};
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function safeFilePath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const aliasedPath = aliases[cleanPath] || cleanPath;
  let filePath = path.join(root, aliasedPath);

  if (aliasedPath.endsWith('/')) {
    filePath = path.join(filePath, 'index.html');
  } else if (!path.extname(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
    filePath = path.join(filePath, 'index.html');
  }

  if (filePath.indexOf(root) !== 0) {
    return null;
  }

  return filePath;
}

http.createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);

  if (redirects[requestPath]) {
    response.writeHead(302, {
      'Cache-Control': 'no-store',
      'Location': redirects[requestPath]
    });
    response.end();
    return;
  }

  const isStoryPreview = Boolean(aliases[requestPath]) || requestPath.indexOf('/story/') === 0;
  const filePath = safeFilePath(request.url || '/');

  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }

    let output = data;

    if (isStoryPreview && path.extname(filePath).toLowerCase() === '.html') {
      output = Buffer.from(data.toString('utf8')
        .replace(/<script[^>]+scripts\.mediavine\.com[^>]*><\/script>/gi, '')
        .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, ''));
    }

    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
    });
    response.end(output);
  });
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Story previews: http://127.0.0.1:${port}/post1, /post2 (post1 + sidebar), /post3, and /post4\n`);
});
