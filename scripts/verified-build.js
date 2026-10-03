'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function fingerprint(root, entries, exclude = '') {
  const hash = crypto.createHash('sha256');
  function add(relative) {
    if (relative === exclude) return;
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) throw new Error(`Build input is missing: ${relative}`);
    if (fs.statSync(file).isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) add(path.join(relative, name));
    } else {
      hash.update(relative).update('\0').update(fs.readFileSync(file)).update('\0');
    }
  }
  entries.forEach(add);
  return hash.digest('hex');
}
const sourceEntries = ['tsg.yml','package.json','package-lock.json','webpack.config.js','postcss.config.js','.babelrc','src','scripts','static/assets/fonts'];
const proofFile = 'build/.verified-publish-build.json';
const sourceFingerprint = root => fingerprint(root, sourceEntries);
function outputFingerprint(root) { return fingerprint(root, ['build'], proofFile); }
function recordBuild(root, source) {
  if (sourceFingerprint(root) !== source) throw new Error('Source changed during generation. Generate again before publishing.');
  fs.writeFileSync(path.join(root, proofFile), JSON.stringify({source, output:outputFingerprint(root), verifiedAt:new Date().toISOString()}));
}
function verifyBuild(root) {
  const proof = JSON.parse(fs.readFileSync(path.join(root, proofFile), 'utf8'));
  if (proof.source !== sourceFingerprint(root)) throw new Error('Source changed since validation. Run npm run deploy without --publish-verified.');
  if (proof.output !== outputFingerprint(root)) throw new Error('Generated files changed since validation. Generate again before publishing.');
}
module.exports = {sourceFingerprint, recordBuild, verifyBuild, fingerprint};
