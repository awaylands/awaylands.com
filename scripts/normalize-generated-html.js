const fs = require('fs');
const path = require('path');

const buildRoot = path.resolve(__dirname, '..', 'build');

function walk(directory, files = []) {
  fs.readdirSync(directory, {withFileTypes: true}).forEach(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target, files);
    else if (entry.name.endsWith('.html')) files.push(target);
  });
  return files;
}

function uniqueIds(html) {
  const seen = {};
  return html.replace(/\sid=(['"])([^'"]+)\1/gi, (attribute, quote, id) => {
    const count = seen[id] || 0;
    seen[id] = count + 1;
    return count ? ` id=${quote}${id}-duplicate-${count}${quote}` : attribute;
  });
}

let changed = 0;
walk(buildRoot).forEach(file => {
  const source = fs.readFileSync(file, 'utf8');
  const normalized = uniqueIds(source);
  if (normalized !== source) {
    fs.writeFileSync(file, normalized);
    changed += 1;
  }
});

process.stdout.write(`Normalized duplicate IDs in ${changed} generated pages.\n`);
