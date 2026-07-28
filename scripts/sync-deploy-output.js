const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');

const root = path.resolve(__dirname, '..');
const buildPath = path.join(root, 'build');
const deployPath = path.join(root, 'static');

if (!fs.existsSync(buildPath)) {
  throw new Error('Generated build output is missing. Run the site generator before deploying.');
}

for (const entry of fs.readdirSync(buildPath)) {
  if (entry === 'static') continue;
  fsExtra.copySync(path.join(buildPath, entry), path.join(deployPath, entry));
}

fsExtra.copySync(
  path.join(buildPath, 'static', 'assets'),
  path.join(deployPath, 'assets'),
  { recursive: true }
);

process.stdout.write('Deploy folder synchronized from build output.\n');
