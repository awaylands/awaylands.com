#!/usr/bin/env node
'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const apply = process.argv.includes('--apply');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, '.takeshaperc'), 'utf8'));
const endpoint = new URL(`${config.endpoint}/project/${config.projectId}/production/graphql`);

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
          const parsed = JSON.parse(body);
          if (parsed.errors) reject(new Error(JSON.stringify(parsed.errors)));
          else resolve(parsed.data);
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.end(JSON.stringify({ query, variables }));
  });
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

async function loadStories() {
  const query = `query StorySlugAudit($from: Int!) {
    getStoryList(size: 250, from: $from) {
      total
      items { _id title slug }
    }
  }`;
  const stories = [];
  let total = 1;
  for (let from = 0; from < total; from += 250) {
    const data = await request(query, { from });
    total = data.getStoryList.total;
    stories.push(...data.getStoryList.items);
  }
  return stories;
}

async function updateStorySlug(story, slug) {
  const mutation = `mutation FillStorySlug($input: UpdateStoryInput!) {
    updateStory(input: $input) { result { _id slug } }
  }`;
  return request(mutation, { input: { _id: story._id, slug } });
}

(async () => {
  const stories = await loadStories();
  const planned = stories.filter(story => !story.slug).map(story => ({
    story,
    slug: slugify(story.title)
  }));
  const owners = new Map();
  stories.forEach(story => {
    const slug = story.slug || slugify(story.title);
    if (!owners.has(slug)) owners.set(slug, []);
    owners.get(slug).push(story.title);
  });
  const collisions = [...owners.entries()].filter(([, titles]) => titles.length > 1);
  const invalid = planned.filter(item => !item.slug);
  if (collisions.length || invalid.length) {
    throw new Error(`Slug repair blocked: ${collisions.length} collisions and ${invalid.length} empty derived slugs.`);
  }
  process.stdout.write(`${JSON.stringify({ mode: apply ? 'apply' : 'dry-run', total: stories.length, missing: planned.length, collisions: 0 }, null, 2)}\n`);
  if (!apply) return;
  for (let index = 0; index < planned.length; index += 1) {
    const item = planned[index];
    await updateStorySlug(item.story, item.slug);
    if ((index + 1) % 25 === 0 || index + 1 === planned.length) {
      process.stdout.write(`Updated ${index + 1}/${planned.length} story slugs.\n`);
    }
  }
})().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
