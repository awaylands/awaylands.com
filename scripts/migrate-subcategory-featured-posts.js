#!/usr/bin/env node
'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const apply = process.argv.includes('--apply');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, '.takeshaperc'), 'utf8'));
const endpoint = new URL(`${config.endpoint}/project/${config.projectId}/production/graphql`);
const backupPath = path.join(root, '.migration-backups', 'subcategory-featured-before-2026-09-21.json');

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

const storyFields = '_id title slug';
const inventoryQuery = `query SubcategoryFeaturedInventory {
  getCategoryList(size: 250, onlyEnabled: false) {
    items {
      _id
      title
      parentCategory {
        _id
        title
        guideCards {
          title
          cards { post { ${storyFields} } }
          post { ${storyFields} }
          post2 { ${storyFields} }
          post3 { ${storyFields} }
          post4 { ${storyFields} }
        }
      }
      featuredStories { ${storyFields} }
      featuredCards { post { ${storyFields} } }
      storySet(size: 250, onlyEnabled: true, sort: [{field: "_enabledAt", order: "desc"}]) {
        items { ${storyFields} }
      }
    }
  }
}`;

function uniqueStories(items) {
  return [...new Map((items || []).filter(item => item && item._id).map(item => [item._id, item])).values()];
}

function relation(story) {
  return {id: story._id};
}

function currentFallback(category) {
  const categoryStories = category.storySet.items || [];
  const categoryStoryIds = new Set(categoryStories.map(story => story._id));
  const guide = (category.parentCategory.guideCards || []).find(card =>
    String(card.title || '').toLowerCase() === String(category.title || '').toLowerCase()
  );
  const guideStories = guide ? [
    ...(guide.cards || []).map(card => card.post),
    guide.post,
    guide.post2,
    guide.post3,
    guide.post4
  ].filter(story => story && categoryStoryIds.has(story._id)) : [];
  return uniqueStories([...guideStories, ...categoryStories]);
}

async function updateCategory(categoryId, stories) {
  const mutation = `mutation UpdateSubcategoryFeatured($input: UpdateCategoryInput!) {
    updateCategory(input: $input) { result { _id title featuredStories { _id title } } }
  }`;
  return request(mutation, {
    input: {
      _id: categoryId,
      featuredStories: stories.map(relation)
    }
  });
}

(async () => {
  const data = await request(inventoryQuery);
  const subcategories = data.getCategoryList.items.filter(category =>
    category.parentCategory && category.parentCategory.title !== category.title
  );
  const plans = subcategories.map(category => {
    const recommended = (category.featuredCards || []).map(card => card.post).filter(Boolean);
    const existing = category.featuredStories || [];
    const fallback = currentFallback(category);
    const desired = uniqueStories([...recommended, ...existing, ...fallback]).slice(0, 2);
    const beforeIds = existing.map(story => story._id);
    const afterIds = desired.map(story => story._id);
    return {
      category,
      desired,
      changed: JSON.stringify(beforeIds) !== JSON.stringify(afterIds),
      source: recommended.length ? 'recommended-reading-first' : existing.length ? 'existing-featured-first' : 'current-start-here'
    };
  });
  const changes = plans.filter(plan => plan.changed);

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    subcategories: subcategories.length,
    updates: changes.map(plan => ({
      title: plan.category.title,
      source: plan.source,
      before: (plan.category.featuredStories || []).map(story => story.title),
      after: plan.desired.map(story => story.title)
    }))
  }, null, 2));

  if (!apply) return;

  fs.mkdirSync(path.dirname(backupPath), {recursive: true});
  fs.writeFileSync(backupPath, `${JSON.stringify({
    createdAt: new Date().toISOString(),
    categories: subcategories.map(category => ({
      _id: category._id,
      title: category.title,
      featuredStories: category.featuredStories || []
    }))
  }, null, 2)}\n`);

  for (const plan of changes) {
    await updateCategory(plan.category._id, plan.desired);
    console.log(`Updated featured posts: ${plan.category.title}`);
  }
})().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
