const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'static', 'assets', 'fonts');
const destination = path.join(root, 'build', 'assets', 'fonts');

if (!fs.existsSync(destination)) fs.mkdirSync(destination);
childProcess.execFileSync('cp', ['-R', `${source}/.`, destination]);
