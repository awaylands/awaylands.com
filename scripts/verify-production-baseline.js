const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const baseline = JSON.parse(fs.readFileSync(path.join(root, '.production-baseline.json'), 'utf8'));

function fail(message) {
  process.stderr.write(`Production deploy blocked: ${message}\n`);
  process.exit(1);
}

function git() {
  return childProcess.execFileSync('git', Array.from(arguments), {
    cwd: root,
    encoding: 'utf8'
  }).trim();
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
}

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function requireText(text, pattern, message) {
  if (!pattern.test(text)) {
    fail(message);
  }
}

const branch = git('branch', '--show-current');
if (branch !== baseline.branch) {
  fail(`run this only from branch ${baseline.branch}, not ${branch || 'a detached checkout'}.`);
}

try {
  childProcess.execFileSync('git', ['merge-base', '--is-ancestor', baseline.baselineCommit, 'HEAD'], {
    cwd: root,
    stdio: 'ignore'
  });
} catch (error) {
  fail(`the current commit does not descend from verified baseline ${baseline.baselineCommit}.`);
}

const status = git('status', '--porcelain');
if (status) {
  fail('the production worktree has uncommitted changes.');
}

const takeShapeConfigPath = path.join(root, '.takeshaperc');
if (!fs.existsSync(takeShapeConfigPath)) {
  fail('the production TakeShape configuration is missing.');
}

if ((fs.statSync(takeShapeConfigPath).mode & 0o077) !== 0) {
  fail('the production TakeShape configuration must use private file permissions (0600).');
}

const takeShapeConfig = JSON.parse(fs.readFileSync(takeShapeConfigPath, 'utf8'));
if (takeShapeConfig.siteId !== baseline.siteId || takeShapeConfig.siteName !== baseline.siteName) {
  fail(`TakeShape must target ${baseline.siteName}.`);
}

const siteConfigPath = path.join(root, 'tsg.yml');
if (!fs.existsSync(siteConfigPath)) {
  fail('the TakeShape site configuration is missing.');
}

const siteConfig = fs.readFileSync(siteConfigPath, 'utf8');
if (!/^templatePath:\s*src\/templates\s*$/m.test(siteConfig)) {
  fail('the deploy template input must be src/templates.');
}
if (!/^staticPath:\s*build\s*$/m.test(siteConfig)) {
  fail('the deploy asset input must be build.');
}
if (!/^buildPath:\s*build\s*$/m.test(siteConfig)) {
  fail('the generated build output must be build.');
}

if (!fs.existsSync(path.join(root, 'build'))) {
  fail('the generated build output is missing. Run the site generator before deploying.');
}

const mediavinePartial = source('src/templates/partials/mediavine.html');
const defaultLayout = source('src/templates/layouts/default.html');
const storyTemplate = source('src/templates/pages/stories/detail.html');
const mediavineStyles = source('src/stylesheets/_mediavine.scss');
const headTemplate = source('src/templates/partials/head.html');
const productionReminder = source('PRODUCTION_BASELINE.md');

requireText(
  productionReminder,
  /A failed Mediavine check\s+is a release blocker\./,
  'the production Mediavine protection reminder is missing.'
);

requireText(
  mediavinePartial,
  /content_selector\s*=\s*'\.main \.story-page \.story-article__body'/,
  'Mediavine content selector is missing or changed.'
);
requireText(
  mediavinePartial,
  /sidebar_atf_selector\s*=\s*'\.story-mediavine-sidebar'/,
  'Mediavine ATF sidebar selector is missing or changed.'
);
requireText(
  mediavinePartial,
  /sidebar_atf_position\s*=\s*'afterbegin'/,
  'Mediavine ATF sidebar position is not configured at the top.'
);
requireText(
  mediavinePartial,
  /sidebar_btf_selector\s*=\s*'\.story-mediavine-sidebar'/,
  'Mediavine BTF sidebar selector is missing or changed.'
);
requireText(
  mediavinePartial,
  /sidebar_btf_position\s*=\s*'beforeend'/,
  'Mediavine BTF sidebar position is not configured at the bottom.'
);
if ((mediavinePartial.match(/scripts\.mediavine\.com\/tags\/away-lands\.js/g) || []).length !== 1) {
  fail('the Mediavine wrapper must appear exactly once in its partial.');
}
requireText(
  defaultLayout,
  /include "partials\/mediavine\.html"/,
  'the default layout no longer includes the Mediavine partial.'
);
if (/scripts\.mediavine\.com\/tags\/away-lands\.js/.test(headTemplate)) {
  fail('the Mediavine wrapper must not be duplicated in the head partial.');
}
const atfMarker = storyTemplate.indexOf('story-mediavine-sidebar-atf');
const tocMarker = storyTemplate.indexOf('data-story-toc');
const btfMarker = storyTemplate.indexOf('story-mediavine-sidebar-btf');
if (atfMarker < 0 || tocMarker < 0 || btfMarker < 0 || atfMarker > tocMarker || btfMarker < tocMarker) {
  fail('story sidebar targets are not ordered as ATF, sidebar content, BTF.');
}
requireText(
  mediavineStyles,
  /\.story-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+300px/,
  'the desktop story sidebar no longer has a 300px column.'
);
requireText(
  mediavineStyles,
  /width:\s*300px;[\s\S]*?min-width:\s*300px;/,
  'the desktop Mediavine sidebar no longer has a fixed 300px minimum width.'
);

const storyBuildRoot = path.join(root, 'build/story');
if (!fs.existsSync(storyBuildRoot)) {
  fail('the generated story output is missing.');
}
const storyPages = fs.readdirSync(storyBuildRoot)
  .map(slug => path.join(storyBuildRoot, slug, 'index.html'))
  .filter(file => fs.existsSync(file));
storyPages.forEach(file => {
  const html = fs.readFileSync(file, 'utf8');
  if (!/story-page/.test(html)) {
    return;
  }
  if ((html.match(/scripts\.mediavine\.com\/tags\/away-lands\.js/g) || []).length !== 1) {
    fail(`story page does not contain exactly one Mediavine wrapper: ${path.relative(root, file)}.`);
  }
  ['content_selector', 'sidebar_atf_selector', 'sidebar_btf_selector'].forEach(key => {
    if (html.indexOf(key) < 0) {
      fail(`story page is missing the Mediavine ${key}: ${path.relative(root, file)}.`);
    }
  });
  if (html.indexOf('story-mediavine-sidebar-atf') > html.indexOf('data-story-toc') ||
      html.indexOf('story-mediavine-sidebar-btf') < html.indexOf('data-story-toc')) {
    fail(`story sidebar target order is broken: ${path.relative(root, file)}.`);
  }
});

['build/film', 'build/still'].forEach(directory => {
  const outputRoot = path.join(root, directory);
  if (!fs.existsSync(outputRoot)) {
    return;
  }
  const outputFiles = [];
  (function collect(current) {
    fs.readdirSync(current, { withFileTypes: true }).forEach(entry => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        collect(fullPath);
      } else if (entry.name.endsWith('.html')) {
        outputFiles.push(fullPath);
      }
    });
  }(outputRoot));
  outputFiles.forEach(file => {
    if (/scripts\.mediavine\.com\/tags\/away-lands\.js/.test(fs.readFileSync(file, 'utf8'))) {
      fail(`Mediavine wrapper must not load on Film or Still output: ${path.relative(root, file)}.`);
    }
  });
});

const schemaSnapshotPath = path.join(root, '_takeshape-schema-export/schema.json');
const schemaSnapshot = JSON.parse(fs.readFileSync(schemaSnapshotPath, 'utf8'));
if (
  schemaSnapshot.version !== baseline.schema.version ||
  schemaSnapshot.schemaHash !== baseline.schema.hash
) {
  fail(`the stored TakeShape schema does not match verified backend schema version ${baseline.schema.version}.`);
}

Object.keys(baseline.sourceFiles).forEach(file => {
  if (!fs.existsSync(path.join(root, file))) {
    fail(`required baseline file is missing: ${file}.`);
  }
  if (sha256(file) !== baseline.sourceFiles[file]) {
    fail(`baseline file changed without approval: ${file}.`);
  }
});

const assetManifestPath = path.join(root, 'build/assets/manifest.json');
if (!fs.existsSync(assetManifestPath)) {
  fail('compiled asset manifest is missing. Restore the verified assets before deploying.');
}

const assetManifest = JSON.parse(fs.readFileSync(assetManifestPath, 'utf8'));
['javascripts/main.js', 'stylesheets/main.css'].forEach(key => {
  const asset = assetManifest[key];
  if (!asset || !/^(javascripts|stylesheets)\/main\.[^/]+\.(js|css)$/.test(asset)) {
    fail(`compiled asset manifest has no valid hashed ${key} entry.`);
  }
  if (!fs.existsSync(path.join(root, 'build/assets', asset))) {
    fail(`compiled asset is missing from build/assets: ${asset}`);
  }
});

process.stdout.write(`Production baseline verified for ${baseline.siteName}.\n`);
