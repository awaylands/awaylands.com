const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bundledNode = '/Users/amyseder/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node';
const configuredNode = process.env.AWAYLANDS_NODE;
const node = configuredNode && fs.existsSync(configuredNode)
  ? configuredNode
  : (fs.existsSync(bundledNode) ? bundledNode : process.execPath);
const takeShape = path.join(root, 'node_modules/@takeshape/cli/dist/index.cjs');
const manifestPath = path.join(root, 'build/assets/manifest.json');

function run(command, args) {
  childProcess.execFileSync(command, args, { cwd: root, stdio: 'inherit' });
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

function fetch(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'accept-encoding': 'identity',
        'user-agent': 'awaylands-production-verifier'
      }
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    }).on('error', reject);
    request.setTimeout(20000, () => request.destroy(new Error(`Timed out fetching ${url}`)));
  });
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
    '/still/'
  ];
  const expectedCss = `/assets/${assets.css}`;
  const expectedJs = `/assets/${assets.js}`;
  const localCssHash = sha256(path.join(root, 'build/assets', assets.css));
  const localJsHash = sha256(path.join(root, 'build/assets', assets.js));
  for (const page of pages) {
    const result = await fetch(`https://www.awaylands.com${page}?${cacheBust}`);
    if (result.status !== 200) fail(`${page} returned HTTP ${result.status}.`);
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
  }
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
  const maximumAttempts = 20;
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
      process.stdout.write(`Live verification attempt ${attempt} is waiting for origin publication.\n`);
      await wait(15000);
    }
  }

  throw lastError;
}

function generateSite() {
  const configPath = path.join(root, '.tsg-production-build.yml');
  const generatedPath = path.join(root, '.deploy-generated');
  const staticPath = path.join(root, '.deploy-static');
  const config = fs.readFileSync(path.join(root, 'tsg.yml'), 'utf8')
    .replace(/^buildPath:\s*build\s*$/m, 'buildPath: .deploy-generated')
    .replace(/^staticPath:\s*build\s*$/m, 'staticPath: .deploy-static');
  fs.writeFileSync(configPath, config);
  try {
    copyTree(path.join(root, 'build/assets'), path.join(staticPath, 'assets'));
    run(node, [takeShape, 'build', '--file', '.tsg-production-build.yml']);
    clearDirectory(path.join(root, 'build'));
    copyTree(generatedPath, path.join(root, 'build'));
    run(node, [path.join(root, 'scripts/generate-destination-route-aliases.js')]);
    run(node, [path.join(root, 'scripts/generate-category-route-aliases.js')]);
  } finally {
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    removeTree(generatedPath);
    removeTree(staticPath);
  }
}

async function main() {
  run('npm', ['run', 'build']);
  const builtAssets = getManifestAssets();
  generateSite();
  const assets = getManifestAssets();
  if (assets.css !== builtAssets.css || assets.js !== builtAssets.js) fail('site generation changed the compiled manifest.');
  normalizeGeneratedAssets(assets);
  verifyGeneratedHtml(assets);
  run(node, [path.join(root, 'scripts/verify-production-baseline.js')]);
  run(node, [takeShape, 'deploy', '--file', 'tsg.yml']);
  await verifyLive(assets);
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
