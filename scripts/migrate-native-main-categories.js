#!/usr/bin/env node
'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const apply = process.argv.includes('--apply');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, '.takeshaperc'), 'utf8'));
const endpoint = new URL(`${config.endpoint}/project/${config.projectId}/production/graphql`);
const mainTitles = [
  'Beauty',
  'Features',
  'Home And Garden',
  'Hotels',
  'Packing Guides',
  'Photography',
  'Travel Guides',
  'Travel Style',
  'Wedding And Honeymoon',
  'Wellness'
];

function request(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: endpoint.hostname,
      path: endpoint.pathname,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.linkedApiKey.apiKey}`,
        'Content-Type': 'application/json'
      }
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const payload = JSON.parse(body);
          if (payload.errors) reject(new Error(JSON.stringify(payload.errors)));
          else resolve(payload.data);
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.end(JSON.stringify({query, variables}));
  });
}

const relation = id => ({id});

async function inventory() {
  const data = await request(`query NativeMainCategoryInventory {
    getMainCategoryList(size: 100, onlyEnabled: false) {
      items { _id title }
    }
    getCategoryList(size: 250, onlyEnabled: false) {
      items {
        _id title
        parentCategory { _id title }
        mainCategoryTag { _id title }
      }
    }
  }`);
  const storyPages = await Promise.all([0, 250, 500, 750, 1000].map(from => request(`query NativeMainCategoryStories {
    getStoryList(size: 250, from: ${from}, onlyEnabled: false) {
      items {
        _id title
        category { _id title parentCategory { _id title } }
        mainCategory { _id title }
      }
    }
  }`)));
  data.stories = storyPages.flatMap(page => page.getStoryList.items || []);
  return data;
}

async function createMainCategory(title) {
  const data = await request(`mutation CreateNativeMainCategory($input: CreateMainCategoryInput!) {
    createMainCategory(input: $input) { result { _id title } }
  }`, {input: {title}});
  return data.createMainCategory.result;
}

async function updateCategory(id, mainCategoryId) {
  await request(`mutation ConnectNativeMainCategory($input: UpdateCategoryInput!) {
    updateCategory(input: $input) { result { _id title } }
  }`, {input: {_id: id, mainCategoryTag: relation(mainCategoryId)}});
}

async function updateStory(id, mainCategoryIds) {
  await request(`mutation TagStoryWithNativeMainCategory($input: UpdateStoryInput!) {
    updateStory(input: $input) { result { _id title } }
  }`, {input: {_id: id, mainCategory: mainCategoryIds.map(relation)}});
}

(async () => {
  const data = await inventory();
  const tagsByTitle = new Map(data.getMainCategoryList.items.map(item => [item.title, item]));
  const missing = mainTitles.filter(title => !tagsByTitle.has(title));

  if (apply) {
    for (const title of missing) {
      const created = await createMainCategory(title);
      tagsByTitle.set(title, created);
      console.log(`Created native category: ${title}`);
    }
  }

  const categoryConnections = data.getCategoryList.items.filter(category => {
    const isMain = mainTitles.includes(category.title) && (!category.parentCategory || category.parentCategory.title === category.title);
    const tag = tagsByTitle.get(category.title);
    return isMain && tag && (!category.mainCategoryTag || category.mainCategoryTag._id !== tag._id);
  });

  const storyChanges = [];
  for (const story of data.stories) {
    const desiredTitles = [];
    for (const category of story.category || []) {
      const title = category.parentCategory && category.parentCategory.title !== category.title
        ? category.parentCategory.title
        : category.title;
      if (mainTitles.includes(title) && !desiredTitles.includes(title)) desiredTitles.push(title);
    }
    const desiredIds = desiredTitles.map(title => tagsByTitle.get(title)).filter(Boolean).map(tag => tag._id).sort();
    const currentIds = (story.mainCategory || []).map(tag => tag._id).sort();
    if (JSON.stringify(desiredIds) !== JSON.stringify(currentIds)) storyChanges.push({story, desiredIds, desiredTitles});
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    missingMainCategories: missing,
    categoryPageConnections: categoryConnections.map(item => item.title),
    storyUpdates: storyChanges.length,
    storySamples: storyChanges.slice(0, 12).map(change => ({title: change.story.title, categories: change.desiredTitles}))
  }, null, 2));

  if (!apply) return;

  for (const category of categoryConnections) {
    await updateCategory(category._id, tagsByTitle.get(category.title)._id);
    console.log(`Connected category page: ${category.title}`);
  }
  const failedStories = [];
  let updatedStories = 0;
  for (let index = 0; index < storyChanges.length; index += 1) {
    const change = storyChanges[index];
    try {
      await updateStory(change.story._id, change.desiredIds);
      updatedStories += 1;
    } catch (error) {
      failedStories.push({
        id: change.story._id,
        title: change.story.title,
        error: error.message || String(error)
      });
    }
    if ((index + 1) % 50 === 0 || index + 1 === storyChanges.length) {
      console.log(`Processed ${index + 1}/${storyChanges.length} stories; tagged ${updatedStories}`);
    }
  }
  if (failedStories.length) console.log(JSON.stringify({failedStories}, null, 2));
})().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
