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
if (
  assetManifest['javascripts/main.js'] !== baseline.assets.javascript ||
  assetManifest['stylesheets/main.css'] !== baseline.assets.stylesheet
) {
  fail('compiled assets do not match the verified production baseline.');
}

if (
  sha256(path.join('build/assets', baseline.assets.javascript)) !== baseline.assets.javascriptSha256 ||
  sha256(path.join('build/assets', baseline.assets.stylesheet)) !== baseline.assets.stylesheetSha256
) {
  fail('compiled asset contents do not match the verified production baseline.');
}

process.stdout.write(`Production baseline verified for ${baseline.siteName}.\n`);
