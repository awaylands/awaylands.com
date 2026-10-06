'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {parse} = require('postcss-scss');
const root = path.resolve(__dirname, '../src/stylesheets');

function filesIn(directory) {
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : file.endsWith('.scss') ? [file] : [];
  });
}

const files = filesIn(root);
const seen = new Set();
function visit(file) {
  assert.ok(!seen.has(file), `Repeated stylesheet import: ${path.relative(root, file)}`);
  seen.add(file);
  const ast = parse(fs.readFileSync(file, 'utf8'), {from:file});
  const rules = new Set();
  ast.walkAtRules('import', rule => {
    const match = rule.params.match(/^['"]([^'"]+)['"]$/);
    assert.ok(match, `Unsupported stylesheet import in ${file}: ${rule.params}`);
    const base = path.resolve(path.dirname(file), match[1]);
    const candidates = [base + '.scss', path.join(path.dirname(base), '_' + path.basename(base) + '.scss')];
    const imported = candidates.find(candidate => fs.existsSync(candidate));
    assert.ok(imported, `Missing stylesheet import: ${match[1]} in ${file}`);
    visit(imported);
  });
  ast.walkRules(rule => {
    // Only exact, plain declaration blocks; intentional cascade overrides remain valid.
    if (!rule.nodes.every(node => node.type === 'decl') || rule.toString().includes('$')) return;
    const context = [];
    for (let node = rule.parent; node.type !== 'root'; node = node.parent) {
      context.push(node.type === 'atrule' ? '@' + node.name + ' ' + node.params : node.selector);
    }
    const key = JSON.stringify([context, rule.selector, rule.nodes.map(node => [node.prop, node.value, node.important])]);
    assert.ok(!rules.has(key), `Repeated declaration block in ${path.relative(root, file)}:${rule.source.start.line}: ${rule.selector}`);
    rules.add(key);
  });
}
visit(path.join(root, 'main.scss'));
assert.deepEqual(files.filter(file => !seen.has(file)), [], 'Unreferenced SCSS files must be removed or explicitly imported.');
console.log(`Stylesheet structure verified: ${files.length} files, each imported once, no exact repeated declaration blocks.`);
