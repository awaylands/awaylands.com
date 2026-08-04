#!/usr/bin/env node
'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const apply = process.argv.includes('--apply');
const root = path.resolve(__dirname, '..');
const snapshotPath = path.join(root, '.migration-backups/editor-content-before-backfill.json');
const config = JSON.parse(fs.readFileSync(path.join(root, '.takeshaperc'), 'utf8'));
const endpoint = new URL(`${config.endpoint}/project/${config.projectId}/production/graphql`);

if (!fs.existsSync(snapshotPath)) {
  throw new Error(`Missing pre-backfill snapshot: ${snapshotPath}`);
}

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
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.errors) reject(new Error(JSON.stringify(parsed.errors)));
          else resolve(parsed.data);
        } catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.end(JSON.stringify({ query, variables }));
  });
}

const asset = `_id path`;
const story = `_id title slug tout { dek image { ${asset} } secondaryImage { ${asset} } }`;
const pageCard = `post { ${story} } image { ${asset} } eyebrow title description linkText linkUrl`;
const cardFields = ['featuredCards', 'destinationCards', 'collectionCards', 'updatedCards', 'indexCards', 'browseCards', 'relatedCards'];
const descriptionFields = cardFields.filter((field) => field !== 'relatedCards');

const inventoryQuery = `query CategoryCardRestoreInventory {
  categories: getCategoryList(size: 100) { items {
    _id title
    ${cardFields.map((field) => `${field} { ${pageCard} }`).join('\n    ')}
  }}
}`;

const rel = (item) => item && item._id ? { id: item._id } : null;

function cardInput(card, description) {
  return {
    post: rel(card && card.post),
    image: rel(card && card.image),
    eyebrow: (card && card.eyebrow) || '',
    title: (card && card.title) || '',
    description: description || '',
    linkText: (card && card.linkText) || '',
    linkUrl: (card && card.linkUrl) || ''
  };
}

function sameCards(a, b) {
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}

async function updateCategory(input) {
  const mutation = `mutation RestoreCategoryCards($input: UpdateCategoryInput!) {
    updateCategory(input: $input) { result { _id title } }
  }`;
  return request(mutation, { input });
}

(async () => {
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const beforeById = new Map(snapshot.categories.items.map((category) => [category._id, category]));
  const current = await request(inventoryQuery);
  const changes = [];

  for (const category of current.categories.items) {
    const before = beforeById.get(category._id);
    if (!before) continue;
    const input = { _id: category._id };
    const fields = [];

    for (const field of descriptionFields) {
      const currentCards = category[field] || [];
      const beforeCards = before[field] || [];
      const restored = currentCards.map((card, index) => cardInput(card, beforeCards[index] && beforeCards[index].description));
      const normalizedCurrent = currentCards.map((card) => cardInput(card, card.description));
      if (!sameCards(normalizedCurrent, restored)) {
        input[field] = restored;
        fields.push(`${field}.description`);
      }
    }

    const restoredRelated = (before.relatedCards || []).map((card) => cardInput(card, card.description));
    const currentRelated = (category.relatedCards || []).map((card) => cardInput(card, card.description));
    if (!sameCards(currentRelated, restoredRelated)) {
      input.relatedCards = restoredRelated;
      fields.push('relatedCards (exact pre-backfill content)');
    }

    if (fields.length) changes.push({ title: category.title, fields, input });
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', categories: changes.map(({ title, fields }) => ({ title, fields })) }, null, 2));
  if (!apply) return;

  for (const change of changes) {
    await updateCategory(change.input);
    console.log(`Restored Category: ${change.title}`);
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
