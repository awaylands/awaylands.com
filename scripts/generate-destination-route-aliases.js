const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const buildRootArgument = process.argv.find(argument => argument.startsWith('--build-root='));
const buildRoot = buildRootArgument
  ? path.resolve(projectRoot, buildRootArgument.slice('--build-root='.length))
  : path.join(projectRoot, 'build');
const canonicalRoot = path.join(buildRoot, 'destinations');
const outputRoots = [canonicalRoot];

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
<body><a href="${escapedUrl}">Continue to the destination page</a></body>
</html>
`;
}

if (!fs.existsSync(canonicalRoot)) {
  throw new Error('Build destination pages before generating route aliases.');
}

let aliasesWritten = 0;

fs.readdirSync(canonicalRoot, {withFileTypes: true})
  .filter(entry => entry.isDirectory() && entry.name === entry.name.toLowerCase())
  .forEach(entry => {
    const canonicalIndex = path.join(canonicalRoot, entry.name, 'index.html');
    if (!fs.existsSync(canonicalIndex)) return;

    const html = fs.readFileSync(canonicalIndex, 'utf8');
    const titleMatch = html.match(/<h1 class="destination-hero__title[^"]*">([^<]+)<\/h1>/);
    if (!titleMatch) return;

    const displayTitle = titleMatch[1].trim();
    if (!displayTitle || displayTitle === entry.name) return;

    // A case-only alias resolves to the canonical directory on the default
    // macOS filesystem and would overwrite the real page. Those legacy keys
    // already exist on the case-sensitive production host, so only create
    // aliases whose title also differs by spaces or punctuation.
    if (displayTitle.toLowerCase() === entry.name) return;

    const destinationUrl = `/destinations/${entry.name}/`;
    outputRoots.forEach(outputRoot => {
      const aliasDirectory = path.join(outputRoot, displayTitle);
      fs.mkdirSync(aliasDirectory, {recursive: true});
      fs.writeFileSync(path.join(aliasDirectory, 'index.html'), redirectPage(destinationUrl));
    });
    aliasesWritten += 1;
  });

console.log(`Generated ${aliasesWritten} legacy destination route aliases.`);
