const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const buildRootArgument = process.argv.find(argument => argument.startsWith('--build-root='));
const buildRoot = buildRootArgument
  ? path.resolve(projectRoot, buildRootArgument.slice('--build-root='.length))
  : path.join(projectRoot, 'build');

const aliases = [
  {"from":"/category/home-and-garden/home-upgrades-and-renovation/archive/","to":"/category/home-and-garden/home-improvement-diy/archive/"},
  {"from":"/category/home-and-garden/home-and-travel-with-dogs/archive/","to":"/category/features/pets-pet-travel/archive/"},
  {"from":"/category/home-and-garden/travel-inspired-home/archive/","to":"/category/home-and-garden/home-design-decor/archive/"},
  {"from":"/category/home-and-garden/home-upgrades-and-renovation/","to":"/category/home-and-garden/home-improvement-diy/"},
  {"from":"/category/home-and-garden/plants-and-garden/archive/","to":"/category/home-and-garden/plants-garden/archive/"},
  {"from":"/category/home-and-garden/home-and-travel-with-dogs/","to":"/category/features/pets-pet-travel/"},
  {"from":"/category/home-and-garden/home-organization/archive/","to":"/category/home-and-garden/home-living/archive/"},
  {"from":"/category/home-and-garden/outdoor-living/archive/","to":"/category/home-and-garden/plants-garden/archive/"},
  {"from":"/category/home-and-garden/travel-inspired-home/","to":"/category/home-and-garden/home-design-decor/"},
  {"from":"/category/home-and-garden/home-comfort/archive/","to":"/category/home-and-garden/home-living/archive/"},
  {"from":"/category/home-and-garden/plants-and-garden/","to":"/category/home-and-garden/plants-garden/"},
  {"from":"/category/home-and-garden/home-organization/","to":"/category/home-and-garden/home-living/"},
  {"from":"/category/home-and-garden/home-diy/archive/","to":"/category/home-and-garden/home-improvement-diy/archive/"},
  {"from":"/category/home-and-garden/outdoor-living/","to":"/category/home-and-garden/plants-garden/"},
  {"from":"/category/home-and-garden/home-comfort/","to":"/category/home-and-garden/home-living/"},
  {"from":"/category/home-and-garden/home-diy/","to":"/category/home-and-garden/home-improvement-diy/"},
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
  <meta name="robots" content="noindex, follow">
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
