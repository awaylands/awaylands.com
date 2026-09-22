const fs = require('fs');
const https = require('https');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, '.takeshaperc'), 'utf8'));
const endpoint = `${config.endpoint}/project/${config.projectId}/production/graphql`;
const apply = process.argv.includes('--apply');
const backupPath = path.join('/Users/amyseder/Documents/Codex/2026-09-21/sh/outputs', `rich-text-heading-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

function request(query, variables = {}) {
  const body = JSON.stringify({query, variables});
  return new Promise((resolve, reject) => {
    const target = new URL(endpoint);
    const req = https.request({
      hostname: target.hostname,
      path: target.pathname,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.linkedApiKey.apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (payload.errors) reject(new Error(payload.errors.map(error => error.message).join('\n')));
        else resolve(payload.data);
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

function normalizeRichText(value) {
  if (!value) return value;
  if (Array.isArray(value)) return value.map(normalizeRichText);
  if (typeof value !== 'object') return value;
  const result = {};
  Object.keys(value).forEach(key => {
    result[key] = normalizeRichText(value[key]);
  });
  if (result.type === 'header-one') result.type = 'header-two';
  return result;
}

function normalizeHtml(value) {
  if (!value) return value;
  return value.replace(/<\/?h1\b/gi, match => match.replace(/h1/i, 'h2'));
}

function countRichTextH1(value) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countRichTextH1(item), 0);
  if (typeof value !== 'object') return 0;
  return (value.type === 'header-one' ? 1 : 0) + Object.values(value).reduce((sum, item) => sum + countRichTextH1(item), 0);
}

function countHtmlH1(value) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countHtmlH1(item), 0);
  if (typeof value === 'object') return Object.values(value).reduce((sum, item) => sum + countHtmlH1(item), 0);
  return typeof value === 'string' ? (value.match(/<h1\b/gi) || []).length : 0;
}

function relationship(asset) {
  return asset ? {id: asset._id, shapeName: 'Asset'} : null;
}

function contentBlockInput(block) {
  if (block.__typename === 'ContentBlock') return {contentBlock: {content: normalizeRichText(block.content)}};
  if (block.__typename === 'HtmlBlock') return {htmlBlock: {label: block.label, html: normalizeHtml(block.html)}};
  if (block.__typename === 'TableBlock') return {tableBlock: {pastedText: block.pastedText, columnCount: block.columnCount}};
  if (block.__typename === 'StoryImageBlock') {
    return {storyImageBlock: {
      label: block.label,
      image: relationship(block.image),
      size: block.size,
      alignment: block.alignment,
      cropPosition: block.cropPosition,
      spacing: block.spacing,
      caption: block.caption,
      altText: block.altText,
      linkUrl: block.linkUrl,
      linkTarget: block.linkTarget,
    }};
  }
  if (block.__typename === 'StoryGalleryBlock') {
    return {storyGalleryBlock: {
      label: block.label,
      layout: block.layout,
      size: block.size,
      images: block.images.map(item => ({
        image: relationship(item.image),
        caption: item.caption,
        altText: item.altText,
        linkUrl: item.linkUrl,
      })),
    }};
  }
  throw new Error(`Unsupported content block: ${block.__typename}`);
}

const storyFields = `
  _id title slug
  content
  mainHtmlBlock1 mainContentBlock1
  mainHtmlBlock2 mainContentBlock2 mainHtmlBlock3 mainContentBlock3
  mainHtmlBlock4 mainContentBlock4 mainHtmlBlock5 mainContentBlock5
  mainHtmlBlock6 mainContentBlock6
  additionalMainBlocks {
    mainHtmlBlock2 mainContentBlock2 mainHtmlBlock3 mainContentBlock3
    mainHtmlBlock4 mainContentBlock4 mainHtmlBlock5 mainContentBlock5
    mainHtmlBlock6 mainContentBlock6
  }
  extraContentBlocks { content }
  extraHtmlBlocks { label html }
  contentBlocks {
    __typename
    ... on ContentBlock { content }
    ... on HtmlBlock { label html }
    ... on TableBlock { pastedText columnCount }
    ... on StoryImageBlock {
      label image { _id } size alignment cropPosition spacing caption altText linkUrl linkTarget
    }
    ... on StoryGalleryBlock {
      label layout size images { image { _id } caption altText linkUrl }
    }
  }
`;

async function loadState() {
  const stories = [];
  let total = 1;
  for (let from = 0; from < total; from += 250) {
    const data = await request(`query HeadingNormalization($from: Int!) {
      getStoryList(size: 250, from: $from, onlyEnabled: false) { total items { ${storyFields} } }
    }`, {from});
    total = data.getStoryList.total;
    stories.push(...data.getStoryList.items);
  }
  const privacy = (await request('query PrivacyHeadingNormalization { getPrivacy { _id content } }')).getPrivacy;
  return {stories, privacy};
}

function storyCounts(story) {
  const richValues = [story.content, story.mainContentBlock1, story.mainContentBlock2, story.mainContentBlock3, story.mainContentBlock4, story.mainContentBlock5, story.mainContentBlock6]
    .concat(story.extraContentBlocks || [])
    .concat((story.contentBlocks || []).filter(block => block.__typename === 'ContentBlock'))
    .concat(story.additionalMainBlocks || []);
  const htmlValues = [story.mainHtmlBlock1, story.mainHtmlBlock2, story.mainHtmlBlock3, story.mainHtmlBlock4, story.mainHtmlBlock5, story.mainHtmlBlock6]
    .concat(story.extraHtmlBlocks || [])
    .concat((story.contentBlocks || []).filter(block => block.__typename === 'HtmlBlock'))
    .concat(story.additionalMainBlocks || []);
  return {
    rich: richValues.reduce((sum, value) => sum + countRichTextH1(value && (value.content || value)), 0),
    html: htmlValues.reduce((sum, value) => sum + countHtmlH1(value && (value.html || value)), 0),
  };
}

function storyInput(story) {
  const input = {_id: story._id};
  if (countRichTextH1(story.content)) input.content = normalizeRichText(story.content);
  for (let index = 1; index <= 6; index += 1) {
    const richField = `mainContentBlock${index}`;
    const htmlField = `mainHtmlBlock${index}`;
    if (countRichTextH1(story[richField])) input[richField] = normalizeRichText(story[richField]);
    if (countHtmlH1(story[htmlField])) input[htmlField] = normalizeHtml(story[htmlField]);
  }
  if (countRichTextH1(story.extraContentBlocks)) {
    input.extraContentBlocks = (story.extraContentBlocks || []).map(block => ({content: normalizeRichText(block.content)}));
  }
  if (countHtmlH1(story.extraHtmlBlocks)) {
    input.extraHtmlBlocks = (story.extraHtmlBlocks || []).map(block => ({label: block.label, html: normalizeHtml(block.html)}));
  }
  if (countRichTextH1(story.contentBlocks) || countHtmlH1(story.contentBlocks)) {
    input.contentBlocks = (story.contentBlocks || []).map(contentBlockInput);
  }
  if (story.additionalMainBlocks && (countRichTextH1(story.additionalMainBlocks) || countHtmlH1(story.additionalMainBlocks))) {
    input.additionalMainBlocks = {
      mainHtmlBlock2: normalizeHtml(story.additionalMainBlocks.mainHtmlBlock2),
      mainContentBlock2: normalizeRichText(story.additionalMainBlocks.mainContentBlock2),
      mainHtmlBlock3: normalizeHtml(story.additionalMainBlocks.mainHtmlBlock3),
      mainContentBlock3: normalizeRichText(story.additionalMainBlocks.mainContentBlock3),
      mainHtmlBlock4: normalizeHtml(story.additionalMainBlocks.mainHtmlBlock4),
      mainContentBlock4: normalizeRichText(story.additionalMainBlocks.mainContentBlock4),
      mainHtmlBlock5: normalizeHtml(story.additionalMainBlocks.mainHtmlBlock5),
      mainContentBlock5: normalizeRichText(story.additionalMainBlocks.mainContentBlock5),
      mainHtmlBlock6: normalizeHtml(story.additionalMainBlocks.mainHtmlBlock6),
      mainContentBlock6: normalizeRichText(story.additionalMainBlocks.mainContentBlock6),
    };
  }
  return input;
}

async function main() {
  const state = await loadState();
  const affected = state.stories.map(story => ({story, counts: storyCounts(story)}))
    .filter(item => item.counts.rich || item.counts.html);
  const privacyCount = countRichTextH1(state.privacy.content);
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    storiesScanned: state.stories.length,
    storiesAffected: affected.length,
    richTextHeadings: affected.reduce((sum, item) => sum + item.counts.rich, 0) + privacyCount,
    htmlHeadings: affected.reduce((sum, item) => sum + item.counts.html, 0),
    privacyHeadings: privacyCount,
    sample: affected.slice(0, 20).map(item => ({title: item.story.title, slug: item.story.slug, ...item.counts})),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!apply || (!affected.length && !privacyCount)) return;

  fs.mkdirSync(path.dirname(backupPath), {recursive: true});
  fs.writeFileSync(backupPath, JSON.stringify({createdAt: new Date().toISOString(), affected: affected.map(item => item.story), privacy: state.privacy}, null, 2));
  process.stdout.write(`Backup written to ${backupPath}\n`);

  for (let index = 0; index < affected.length; index += 1) {
    const item = affected[index];
    await request(`mutation NormalizeStoryHeadings($input: UpdateStoryInput!) {
      updateStory(input: $input) { result { _id } }
    }`, {input: storyInput(item.story)});
    if ((index + 1) % 25 === 0 || index + 1 === affected.length) {
      process.stdout.write(`Updated ${index + 1} of ${affected.length} stories.\n`);
    }
  }
  if (privacyCount) {
    await request(`mutation NormalizePrivacyHeadings($input: UpdatePrivacyInput!) {
      updatePrivacy(input: $input) { result { _id } }
    }`, {input: {_id: state.privacy._id, content: normalizeRichText(state.privacy.content)}});
  }

  const verified = await loadState();
  const remaining = verified.stories.reduce((sum, story) => {
    const counts = storyCounts(story);
    return sum + counts.rich + counts.html;
  }, 0) + countRichTextH1(verified.privacy.content);
  if (remaining) throw new Error(`Heading verification found ${remaining} remaining content H1 blocks.`);
  process.stdout.write('Verified: no story or privacy rich-text H1 blocks remain.\n');
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
