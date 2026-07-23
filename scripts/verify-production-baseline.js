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

const status = git('status', '--porcelain');
if (status) {
  fail('the production worktree has uncommitted changes.');
}

const takeShapeConfigPath = path.join(root, '.takeshaperc');
if (!fs.existsSync(takeShapeConfigPath)) {
  fail('the production TakeShape configuration is missing.');
}

const takeShapeConfig = JSON.parse(fs.readFileSync(takeShapeConfigPath, 'utf8'));
if (takeShapeConfig.siteId !== baseline.siteId || takeShapeConfig.siteName !== baseline.siteName) {
  fail(`TakeShape must target ${baseline.siteName}.`);
}

Object.keys(baseline.sourceFiles).forEach(file => {
  if (!fs.existsSync(path.join(root, file))) {
    fail(`required baseline file is missing: ${file}.`);
  }
  if (sha256(file) !== baseline.sourceFiles[file]) {
    fail(`baseline file changed without approval: ${file}.`);
  }
});

const assetManifestPath = path.join(root, 'static/assets/manifest.json');
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

process.stdout.write(`Production baseline verified for ${baseline.siteName}.\n`);
