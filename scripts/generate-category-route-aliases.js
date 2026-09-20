const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const buildRootArgument = process.argv.find(argument => argument.startsWith('--build-root='));
const buildRoot = buildRootArgument
  ? path.resolve(projectRoot, buildRootArgument.slice('--build-root='.length))
  : path.join(projectRoot, 'build');

const aliases = [
  {
    from: '/category/wellness/sleep-and-jet-lag/',
    to: '/category/wellness/sleep-jet-lag/'
  },
  {
    from: '/category/wellness/sleep-and-jet-lag/archive/',
    to: '/category/wellness/sleep-jet-lag/archive/'
  }
];

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function redirectPage(destinationUrl) {
  const escapedUrl = escapeHtml(destinationUrl);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${escapedUrl}">
  <link rel="canonical" href="https://www.awaylands.com${escapedUrl}">
  <title>Redirecting…</title>
  <script>window.location.replace(${JSON.stringify(destinationUrl)});</script>
</head>
<body><a href="${escapedUrl}">Continue to the subcategory page</a></body>
</html>
`;
}

aliases.forEach(alias => {
  const canonicalIndex = path.join(buildRoot, alias.to.replace(/^\//, ''), 'index.html');
  if (!fs.existsSync(canonicalIndex)) {
    throw new Error(`Cannot create category alias because ${alias.to} was not generated.`);
  }

  const aliasDirectory = path.join(buildRoot, alias.from.replace(/^\//, ''));
  fs.mkdirSync(aliasDirectory, {recursive: true});
  fs.writeFileSync(path.join(aliasDirectory, 'index.html'), redirectPage(alias.to));
});

console.log(`Generated ${aliases.length} category route aliases.`);
