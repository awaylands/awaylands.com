'use strict';

const fs = require('fs');
const path = require('path');

const STORY_BUILD_PATH = path.resolve(__dirname, '../build/story');
const ANCHOR_PATTERN = /<a\b([^>]*?)\bhref=(["'])(.*?)\2([^>]*)>/gi;
const VALID_URL_PATTERN = /^(?:https?:|mailto:|tel:|#|\/)/i;
const DOMAIN_PATTERN = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?(?:[/?#].*)?$/i;
const EMBEDDED_URL_PATTERN = /https?:\/\/[^\s"'<>]+/i;
const DEAD_INTERNAL_PATHS = new Set([
  '/story/traveling-with-your-dog-essential-health-tips-for-every-pet-parent'
]);

let filesChanged = 0;
let linksRepaired = 0;
let linksDisabled = 0;

function walk(directory) {
  if (!fs.existsSync(directory)) {
    return;
  }

  fs.readdirSync(directory, {withFileTypes: true}).forEach(entry => {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(filePath);
    } else if (entry.name === 'index.html') {
      sanitizeFile(filePath);
    }
  });
}

function normalizeHref(href) {
  const value = href.trim();
  const comparableValue = value.replace(/\/$/, '');

  if (DEAD_INTERNAL_PATHS.has(comparableValue)) {
    return '';
  }

  if (!value || VALID_URL_PATTERN.test(value)) {
    return value;
  }

  const embeddedUrl = value.match(EMBEDDED_URL_PATTERN);

  if (embeddedUrl) {
    return embeddedUrl[0].replace(/&amp;/g, '&');
  }

  if (DOMAIN_PATTERN.test(value)) {
    return `https://${value}`;
  }

  return '';
}

function sanitizeFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = source.replace(ANCHOR_PATTERN, (match, before, quote, href, after) => {
    const normalized = normalizeHref(href);

    if (normalized === href.trim()) {
      return match;
    }

    if (normalized) {
      linksRepaired += 1;
      return `<a${before}href=${quote}${normalized}${quote}${after}>`;
    }

    linksDisabled += 1;
    const safeBefore = before.replace(/\s+(?:target|rel)=("[^"]*"|'[^']*')/gi, '');
    const safeAfter = after.replace(/\s+(?:target|rel)=("[^"]*"|'[^']*')/gi, '');
    return `<a${safeBefore}${safeAfter}>`;
  });

  if (output !== source) {
    fs.writeFileSync(filePath, output);
    filesChanged += 1;
  }
}

walk(STORY_BUILD_PATH);

console.log(
  `Story link cleanup: ${linksRepaired} repaired, ${linksDisabled} disabled in ${filesChanged} files.`
);
