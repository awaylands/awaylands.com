'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const build = path.join(root, 'build');
const staging = path.join(root, 'publish-static');

function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function preparePublishInput(includeRedirects = true) {
  fs.rmSync(staging, {recursive:true, force:true});
  fs.mkdirSync(staging, {recursive:true});
  fs.cpSync(path.join(build, 'assets'), path.join(staging, 'assets'), {recursive:true});
  let redirects = 0;
  if (includeRedirects) {
    for (const file of walk(build)) {
      if (!file.endsWith('.html') || file.startsWith(path.join(build, 'assets') + path.sep)) continue;
      const html = fs.readFileSync(file, 'utf8');
      if (!/<meta[^>]+http-equiv=["']refresh["']/i.test(html)) continue;
      const destination = path.join(staging, path.relative(build, file));
      fs.mkdirSync(path.dirname(destination), {recursive:true});
      fs.copyFileSync(file, destination);
      redirects++;
    }
  }
  const files = walk(staging);
  const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  process.stdout.write(`Publishing input: ${files.length} files, ${(bytes/1024/1024).toFixed(2)} MiB, including ${redirects} redirects.\n`);
  return {files:files.length, bytes, redirects};
}
if (require.main === module) preparePublishInput();
module.exports = {preparePublishInput};
