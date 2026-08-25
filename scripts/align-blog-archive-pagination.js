const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const buildRootArgument = process.argv.find(argument => argument.startsWith('--build-root='));
const buildRoot = buildRootArgument
  ? path.resolve(projectRoot, buildRootArgument.slice('--build-root='.length))
  : path.join(projectRoot, 'build');
const blogRoot = path.join(buildRoot, 'blog');
const blogIndex = path.join(blogRoot, 'index.html');

function fail(message) {
  throw new Error(`Blog archive alignment failed: ${message}`);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function archiveGrid(html, source) {
  const match = html.match(/<div class="blog-archive__grid">([\s\S]*?)<\/div>\s*<\/main>/);
  if (!match) fail(`archive grid is missing from ${source}`);
  return match[1];
}

function replaceArchiveGrid(html, grid, source) {
  if (!/<div class="blog-archive__grid">[\s\S]*?<\/div>\s*<\/main>/.test(html)) {
    fail(`archive grid could not be found in ${source}`);
  }
  const updated = html.replace(
    /(<div class="blog-archive__grid">)[\s\S]*?(<\/div>\s*<\/main>)/,
    `$1${grid}$2`
  );
  return updated;
}

function pageUrl(page) {
  return page === 1 ? '/blog' : `/blog/page-${page}`;
}

function pageLink(page, label, currentPage) {
  if (page === currentPage) return `<li><a class="is-current">${label}</a></li>`;
  return `<li><a href="${pageUrl(page)}">${label}</a></li>`;
}

function pagination(currentPage, totalPages) {
  const firstSvg = read(path.join(projectRoot, 'src/templates/vectors/first.svg'));
  const previousSvg = read(path.join(projectRoot, 'src/templates/vectors/previous.svg'));
  const nextSvg = read(path.join(projectRoot, 'src/templates/vectors/next.svg'));
  const lastSvg = read(path.join(projectRoot, 'src/templates/vectors/last.svg'));
  const links = [];

  links.push(`<li><a href="/blog">${firstSvg}</a></li>`);
  links.push(`<li><a href="${pageUrl(currentPage - 1)}">${previousSvg}</a></li>`);
  links.push(pageLink(1, '1', currentPage));

  if (currentPage > 4) links.push('<li>&hellip;</li>');
  if (currentPage > 3) links.push(pageLink(currentPage - 2, String(currentPage - 2), currentPage));
  if (currentPage > 2) links.push(pageLink(currentPage - 1, String(currentPage - 1), currentPage));
  if (currentPage !== totalPages) links.push(pageLink(currentPage, String(currentPage), currentPage));
  if (currentPage < totalPages - 1) links.push(pageLink(currentPage + 1, String(currentPage + 1), currentPage));
  if (currentPage < totalPages - 2) links.push(pageLink(currentPage + 2, String(currentPage + 2), currentPage));
  if (currentPage < totalPages - 3) links.push('<li>&hellip;</li>');

  links.push(pageLink(totalPages, String(totalPages), currentPage));
  if (currentPage === totalPages) {
    links.push(`<li><a class="is-disabled">${nextSvg}</a></li>`);
    links.push(`<li><a class="is-disabled">${lastSvg}</a></li>`);
  } else {
    links.push(`<li><a href="${pageUrl(currentPage + 1)}">${nextSvg}</a></li>`);
    links.push(`<li><a href="${pageUrl(totalPages)}">${lastSvg}</a></li>`);
  }

  return `<ul class="pagination">${links.join('\n')}</ul>`;
}

function replacePagination(html, currentPage, totalPages, source) {
  const updated = html.replace(/<ul class="pagination">[\s\S]*?<\/ul>/, pagination(currentPage, totalPages));
  if (updated === html) fail(`pagination could not be replaced in ${source}`);
  return updated;
}

function updatePagePath(html, previousPage, currentPage) {
  return html.replace(new RegExp(`/blog/page-${previousPage}(?=[/"<])`, 'g'), `/blog/page-${currentPage}`);
}

if (!fs.existsSync(blogIndex)) fail('build/blog/index.html is missing');

const firstPageHtml = read(blogIndex);
const firstBatchMatch = firstPageHtml.match(/<template data-blog-archive-first-batch>([\s\S]*?)<\/template>/);
if (!firstBatchMatch) fail('the first archive batch is missing from build/blog/index.html');

const archivePages = fs.readdirSync(blogRoot, {withFileTypes: true})
  .filter(entry => entry.isDirectory() && /^page-\d+$/.test(entry.name))
  .map(entry => Number(entry.name.slice(5)))
  .filter(page => page >= 2)
  .sort((left, right) => left - right);

if (!archivePages.length || archivePages[0] !== 2) fail('generated archive pages are missing');

const originalHtml = new Map();
archivePages.forEach(page => {
  const file = path.join(blogRoot, `page-${page}`, 'index.html');
  originalHtml.set(page, read(file));
});

const batches = [firstBatchMatch[1]].concat(
  archivePages.map(page => archiveGrid(originalHtml.get(page), `page-${page}`))
);
const lastGeneratedPage = archivePages[archivePages.length - 1];
const totalPages = lastGeneratedPage + 1;

batches.forEach((batch, index) => {
  const page = index + 2;
  const sourcePage = Math.min(page, lastGeneratedPage);
  let html = originalHtml.get(sourcePage);
  if (page > lastGeneratedPage) html = updatePagePath(html, sourcePage, page);
  html = replaceArchiveGrid(html, batch, `page-${page}`);
  html = replacePagination(html, page, totalPages, `page-${page}`);
  const outputDirectory = path.join(blogRoot, `page-${page}`);
  fs.mkdirSync(outputDirectory, {recursive: true});
  fs.writeFileSync(path.join(outputDirectory, 'index.html'), html);
});

const cleanBlogIndex = firstPageHtml.replace(/\s*<template data-blog-archive-first-batch>[\s\S]*?<\/template>/, '');
fs.writeFileSync(blogIndex, cleanBlogIndex);

const sitemapPath = path.join(buildRoot, 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
  const sitemap = read(sitemapPath);
  const finalUrl = `https://www.awaylands.com/blog/page-${totalPages}`;
  if (!sitemap.includes(finalUrl)) {
    fs.writeFileSync(
      sitemapPath,
      sitemap.replace('</urlset>', `<url><loc>${finalUrl}</loc></url></urlset>`)
    );
  }
}

console.log(`Aligned ${batches.length} blog archive batches across pages 2 through ${totalPages}.`);
