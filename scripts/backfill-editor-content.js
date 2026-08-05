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

const rel = (item) => item && item._id ? { id: item._id } : null;
const rels = (items) => (items || []).filter(Boolean).map(rel);
const blank = (value) => value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);
const choose = (...values) => values.find((value) => !blank(value));
const storyImage = (story) => story && story.tout && (story.tout.image || story.tout.secondaryImage);
const storyUrl = (story) => story && story.slug ? `/story/${story.slug}/` : '';
const unique = (items) => [...new Map((items || []).filter(Boolean).map((item) => [item._id, item])).values()];

function parseDestinationFacts() {
  const source = fs.readFileSync(path.join(root, 'src/templates/data/destination-facts.html'), 'utf8');
  const match = source.match(/\{% set destinationAutofill = (\{[\s\S]*?\}) %\}/);
  if (!match) throw new Error('Could not locate destinationAutofill data.');
  // This repository-owned template literal contains data only.
  return Function(`"use strict"; return (${match[1]});`)(); // eslint-disable-line no-new-func
}

function parseContinentFacts() {
  const source = fs.readFileSync(path.join(root, 'src/templates/pages/location.html'), 'utf8');
  const result = {};
  const blockPattern = /\{% (?:if|elif) destinationTitle == "([^"]+)" %\}\s*\{% set continentGeographyFacts = (\[[\s\S]*?\]) %\}[\s\S]*?\{% set continentSeasonFacts = (\[[\s\S]*?\]) %\}/g;
  for (const match of source.matchAll(blockPattern)) {
    const geography = Function(`"use strict"; return (${match[2]});`)(); // eslint-disable-line no-new-func
    const seasons = Function(`"use strict"; return (${match[3]});`)(); // eslint-disable-line no-new-func
    result[match[1]] = {
      geography: geography.map((item) => `${item.title}|${item.value}`).join('\n'),
      seasons: seasons.map((item) => `${item.title}|${item.value}|${item.note || ''}`).join('\n')
    };
  }
  return result;
}

const asset = `_id path`;
const story = `_id _enabledAt _updatedAt isImportant title slug tout { image { ${asset} } secondaryImage { ${asset} } dek }`;
const pageCard = `post { ${story} } image { ${asset} } eyebrow title description linkText linkUrl`;

const inventoryQuery = `query EditorBackfillInventory {
  categories: getCategoryList(size: 100) { items {
    _id title pageLabel pageHeadline introText introLinkText introLinkUrl
    heroImage { ${asset} } heroStory { ${story} }
    featuredLabel featuredTitle featuredDescription featuredBackgroundImage { ${asset} }
    featuredStories { ${story} } featuredCards { ${pageCard} }
    destinationsLabel destinationsTitle destinationsDescription destinationStories { ${story} } destinationCards { ${pageCard} }
    beautyHeroLabel beautyHeroTitle beautyHeroDescription beautyHeroLinkText beautyHeroLinkUrl beautyHeroImage { ${asset} } beautyHeroPost { ${story} }
    mapLabel mapTitle mapDescription mapImage { ${asset} }
    clustersLabel clustersTitle clustersDescription clusterStories { ${story} } collectionCards { ${pageCard} }
    shopLabel shopTitle shopDescription shopLinkText shopLinkUrl shopImage { ${asset} } shopCards { ${pageCard} }
    updatedLabel updatedTitle updatedDescription updatedBackgroundImage { ${asset} } updatedStories { ${story} } updatedCards { ${pageCard} }
    expertiseLabel expertiseTitle expertiseDescription expertiseImage { ${asset} }
    expertiseStat1Value expertiseStat1Label expertiseStat2Value expertiseStat2Label expertiseStat3Value expertiseStat3Label
    expertiseLink1Text expertiseLink1Url expertiseLink2Text expertiseLink2Url
    indexLabel indexTitle indexDescription indexStories { ${story} } indexCards { ${pageCard} }
    browseLabel browseTitle browseCards { ${pageCard} } relatedLabel relatedTitle relatedCards { ${pageCard} }
    storySet(size: 250) { items { ${story} } }
    social { description image { ${asset} } }
  }}
  locations: getLocationList(size: 250) { items {
    _id title image { ${asset} } social { description image { ${asset} } }
    destinationHeroImage { ${asset} } destinationBlurb destinationBestTime destinationTimeZone destinationCurrency destinationLanguages destinationEnglishNote
    destinationBestPairedWith { _id title } destinationRelatedDestinations { _id title }
    destinationContinueHeading destinationEditorsPicksHeading destinationFeaturedGuideLabel destinationGuidesHeading
    destinationFeaturedStories { ${story} } destinationFeatureStory { ${story} }
    destinationFeaturedOneImage { ${asset} } destinationFeaturedTwoImage { ${asset} } destinationFeatureStoryImage { ${asset} }
    destinationGuideStories { ${story} }
    continentSet(size: 1) { items { _id name locations { _id title } } }
    storySet(size: 250, sort: [{field:"_enabledAt",order:"desc"}]) { items { ${story} } }
    importantStories: storySet(size: 10, where: {isImportant:{eq:true}}, sort: [{field:"_enabledAt",order:"desc"}]) { items { ${story} } }
    preferredStories: storySet(size: 20, where: {category:{title:{in:["Best Beaches","Travel Guides","Packing Guides"]}}}, sort: [{field:"isImportant",order:"desc"},{field:"_enabledAt",order:"desc"}]) { items { ${story} } }
  }}
  continents: getContinentList(size: 50) { items {
    _id name social { description image { ${asset} } } locations { _id title destinationBlurb destinationHeroImage { ${asset} } image { ${asset} } storySet(size: 250, sort: [{field:"_enabledAt",order:"desc"}]) { items { ${story} } } }
    destinationHeroImage { ${asset} } destinationBlurb destinationContinueHeading destinationEditorsPicksHeading destinationFeaturedGuideLabel destinationGuidesHeading
    destinationFeaturedStories { ${story} } destinationFeatureStory { ${story} } destinationFeaturedOneImage { ${asset} } destinationFeaturedTwoImage { ${asset} } destinationFeatureStoryImage { ${asset} } destinationGuideStories { ${story} }
    continentGeographyHeading continentGeographyCards continentSeasonsHeading continentSeasonCards continentMapHeading continentMapBackgroundImage { ${asset} }
    continentMostRequestedLabel continentMostRequestedDestination { _id title destinationBlurb storySet(size: 12, sort: [{field:"_enabledAt",order:"desc"}]) { items { ${story} } } }
    continentMostRequestedTitle continentMostRequestedDescription continentMostRequestedStories { ${story} } continentContinueDestinations { _id title }
  }}
}`;

const categoryDefaults = {
  pageLabel: 'Away Lands Journal', featuredLabel: 'Explore Essentials', featuredTitle: 'Recommended Reading', featuredDescription: 'A compact edit of the guides and stories to open first.',
  destinationsLabel: 'Reader favorites', destinationsTitle: 'Most Popular Destinations', destinationsDescription: 'Start with the destinations readers return to most.',
  mapLabel: 'Plan by place', mapTitle: 'Find Your Next Escape', mapDescription: 'Open a region to explore destination guides, beaches, hotels, itineraries, and practical details.',
  clustersLabel: 'More to discover', clustersTitle: 'Travel Guide Collections', clustersDescription: 'Focused paths into Away Lands destination and planning coverage.',
  updatedLabel: 'Freshly updated', updatedTitle: 'Recently Updated', updatedDescription: 'Guides with newly reviewed recommendations and planning details.',
  expertiseLabel: 'Firsthand since 2016', expertiseTitle: 'Travelled, photographed, and written from experience', expertiseDescription: 'Away Lands has published travel guides from more than 60 countries since 2016. Every guide is shaped by firsthand travel, original photography, and practical planning experience.',
  expertiseStat1Value: '60+', expertiseStat1Label: 'Countries visited', expertiseStat2Value: '10', expertiseStat2Label: 'Years of full-time travel', expertiseStat3Value: '100%', expertiseStat3Label: 'Original perspective',
  expertiseLink1Text: 'Meet Amy & Brandon', expertiseLink1Url: '/about/', expertiseLink2Text: 'View photography', expertiseLink2Url: '/still/',
  indexLabel: 'Browse the archive', indexTitle: 'Travel Guides Index', indexDescription: 'The latest 24 guides, with every major collection linked above.',
  browseLabel: 'Find exactly what you need', relatedLabel: 'Keep exploring', relatedTitle: 'Related Collections',
  shopLabel: 'Travel essentials', shopTitle: 'The Items Always in My Carry-On', shopLinkText: 'View recommendations', shopLinkUrl: '/category/travel-essentials/'
};

function fillCard(card, fallback, defaultLinkText) {
  const selected = card.post || fallback;
  return {
    post: rel(selected), image: rel(card.image || storyImage(selected)), eyebrow: card.eyebrow || '',
    title: choose(card.title, selected && selected.title, ''), description: card.description || '',
    linkText: choose(card.linkText, defaultLinkText, ''), linkUrl: choose(card.linkUrl, storyUrl(selected), '')
  };
}

function categoryInput(page) {
  for (const field of ['featuredStories','featuredCards','destinationStories','destinationCards','clusterStories','collectionCards','shopCards','updatedStories','updatedCards','indexStories','indexCards','browseCards','relatedCards']) page[field] = page[field] || [];
  const stories = [...(page.storySet.items || [])].sort((a, b) => String(b._enabledAt).localeCompare(String(a._enabledAt)));
  const updated = [...stories].sort((a, b) => String(b._updatedAt).localeCompare(String(a._updatedAt)));
  const hero = page.heroStory || page.featuredStories[0] || stories[0];
  const input = { _id: page._id };
  const put = (name, value) => { if (blank(page[name]) && !blank(value)) input[name] = value; };
  put('pageLabel', categoryDefaults.pageLabel);
  put('pageHeadline', `${page.title} Stories Worth Saving`);
  put('introText', choose(page.social && page.social.description, `Firsthand ${page.title.toLowerCase()} guides, practical details, and thoughtful recommendations from more than a decade of travel.`));
  put('introLinkText', 'Browse this page'); put('introLinkUrl', '#category-browse');
  put('heroStory', rel(hero)); put('heroImage', rel(page.heroImage || storyImage(hero)));

  const sectionRules = [
    ['featured', Boolean(page.featuredCards.length || page.featuredStories.length || page.featuredBackgroundImage), ['featuredLabel','featuredTitle','featuredDescription']],
    ['destinations', Boolean(page.destinationCards.length || page.destinationStories.length || page.destinationsLabel || page.destinationsTitle || page.destinationsDescription), ['destinationsLabel','destinationsTitle','destinationsDescription']],
    ['map', Boolean(page.mapImage || page.mapLabel || page.mapTitle || page.mapDescription), ['mapLabel','mapTitle','mapDescription']],
    ['clusters', Boolean(page.collectionCards.length || page.clusterStories.length || page.clustersLabel || page.clustersTitle || page.clustersDescription), ['clustersLabel','clustersTitle','clustersDescription']],
    ['shop', Boolean(page.shopImage || page.shopCards.length || page.shopLabel || page.shopTitle || page.shopDescription || page.shopLinkText || page.shopLinkUrl), ['shopLabel','shopTitle','shopLinkText','shopLinkUrl']],
    ['updated', Boolean(page.updatedCards.length || page.updatedStories.length || page.updatedBackgroundImage || page.updatedLabel || page.updatedTitle || page.updatedDescription), ['updatedLabel','updatedTitle','updatedDescription']],
    ['expertise', Boolean(page.expertiseImage || page.expertiseLabel || page.expertiseTitle || page.expertiseDescription || page.expertiseStat1Value || page.expertiseStat2Value || page.expertiseStat3Value || page.expertiseLink1Text || page.expertiseLink2Text), Object.keys(categoryDefaults).filter((key) => key.startsWith('expertise'))],
    ['index', Boolean(page.indexCards.length || page.indexStories.length || page.indexLabel || page.indexTitle || page.indexDescription), ['indexLabel','indexTitle','indexDescription']],
    ['browse', Boolean(page.browseCards.length || page.browseLabel || page.browseTitle), ['browseLabel']],
    ['related', Boolean(page.relatedCards.length || page.relatedLabel || page.relatedTitle), ['relatedLabel','relatedTitle']]
  ];
  for (const [, active, fields] of sectionRules) if (active) for (const field of fields) put(field, categoryDefaults[field]);
  if (sectionRules.find((r) => r[0] === 'browse')[1]) put('browseTitle', `Browse ${page.title}`);
  if (page.title === 'Travel Guides' && page.shopDescription === 'Useful products and considered recommendations for travel guides.') input.shopDescription = 'The travel essentials I pack, use, and recommend trip after trip.';

  const cardSets = [
    ['featuredCards', stories, 'Read the story'], ['destinationCards', page.destinationStories.length ? page.destinationStories : stories, 'Read the Story'],
    ['collectionCards', page.clusterStories.length ? page.clusterStories : stories, 'Read the Story'], ['updatedCards', page.updatedStories.length ? page.updatedStories : updated, 'Read the story'],
    ['indexCards', page.indexStories.length ? page.indexStories : stories, 'Read the story'], ['browseCards', stories, 'Read the Story'], ['relatedCards', stories.slice(10), 'View category']
  ];
  for (const [field, fallbacks, linkText] of cardSets) if (page[field].length) input[field] = page[field].map((card, index) => fillCard(card, fallbacks[index] || hero, linkText));

  const firstCard = page.featuredCards[0] || {};
  const focusedStory = page.beautyHeroPost || firstCard.post || page.featuredStories[0] || hero;
  const focusedActive = Boolean(page.beautyHeroPost || page.beautyHeroImage || page.beautyHeroLabel || page.beautyHeroTitle || page.beautyHeroDescription || page.beautyHeroLinkText || page.beautyHeroLinkUrl || firstCard.post || firstCard.image || firstCard.title || page.featuredStories.length);
  if (focusedActive) {
    put('beautyHeroPost', rel(focusedStory)); put('beautyHeroImage', rel(page.beautyHeroImage || firstCard.image || storyImage(focusedStory)));
    put('beautyHeroLabel', 'Reader Favorites'); put('beautyHeroTitle', choose(firstCard.title, focusedStory && focusedStory.title));
    put('beautyHeroDescription', choose(focusedStory && focusedStory.tout && focusedStory.tout.dek, ''));
    put('beautyHeroLinkText', choose(firstCard.linkText, 'Read the Story')); put('beautyHeroLinkUrl', choose(firstCard.linkUrl, storyUrl(focusedStory)));
  }
  return input;
}

function locationInput(page, locationsByTitle, facts) {
  for (const field of ['destinationBestPairedWith','destinationRelatedDestinations','destinationFeaturedStories','destinationGuideStories']) page[field] = page[field] || [];
  page.storySet = page.storySet || { items: [] }; page.importantStories = page.importantStories || { items: [] }; page.preferredStories = page.preferredStories || { items: [] }; page.continentSet = page.continentSet || { items: [] };
  const automatic = facts[page.title] || {};
  const stories = page.storySet.items || [];
  const featured = page.destinationFeaturedStories || [];
  const first = featured[0] || page.importantStories.items[0] || page.preferredStories.items[0] || stories[0];
  const second = featured[1] || page.importantStories.items[1] || page.preferredStories.items[1] || stories[1];
  const spotlight = page.destinationFeatureStory || page.importantStories.items[2] || page.preferredStories.items[2] || stories[2];
  const continent = page.continentSet.items[0] || {};
  const special = page.title === 'Hawaii' ? ['California','Mexico','French Polynesia','Cook Islands','Fiji','New Zealand'] :
    continent.name === 'South America' ? ['Argentina','Uruguay','Panama','Costa Rica','Belize','Mexico'] :
    continent.name === 'Africa' ? ['Ethiopia','Morocco','South Africa','Maldives','Oman','United Arab Emirates'] :
    continent.name === 'Middle East' ? ['Oman','United Arab Emirates','Ethiopia','Morocco','South Africa'] : [];
  const relatedNames = special.length ? special : (automatic.related || []).map((x) => x.title);
  const pairedNames = (automatic.paired || []).map((x) => x.title);
  const related = page.destinationRelatedDestinations.length ? page.destinationRelatedDestinations : (relatedNames.length ? relatedNames.map((name) => locationsByTitle.get(name)) : (continent.locations || []).filter((x) => x._id !== page._id).slice(0, 7));
  const paired = page.destinationBestPairedWith.length ? page.destinationBestPairedWith : (pairedNames.length ? pairedNames.map((name) => locationsByTitle.get(name)) : (related.length ? related : (continent.locations || []))).slice(0, 3);
  const group = page.title === 'Hawaii' ? 'the Pacific' : continent.name === 'South America' ? 'South and Central America' : continent.name === 'Africa' ? 'Africa and the Middle East' : continent.name === 'Middle East' ? 'Middle East and Africa' : (continent.name || 'More Destinations');
  const resolvedHero = page.destinationHeroImage || (page.title === 'France' ? null : (page.image || (page.social && page.social.image) || storyImage(first)));
  return {
    _id: page._id,
    // France intentionally retains its repository-owned lavender fallback image.
    destinationHeroImage: rel(resolvedHero),
    destinationBlurb: choose(page.destinationBlurb, automatic.blurb, page.social && page.social.description, 'Explore this destination through our travel guides, destination notes, and firsthand stories.'),
    destinationBestTime: choose(page.destinationBestTime, automatic.bestTime, 'Seasonality varies by destination. Check each guide for the best local timing.'),
    destinationTimeZone: choose(page.destinationTimeZone, automatic.timeZone, 'Multiple time zones|UTC offsets vary by region'),
    destinationCurrency: choose(page.destinationCurrency, automatic.currency, 'Varies by destination'),
    destinationLanguages: choose(page.destinationLanguages, automatic.languages, 'Varies by destination'),
    destinationEnglishNote: choose(page.destinationEnglishNote, automatic.englishNote, 'English availability varies by destination.'),
    destinationBestPairedWith: rels(unique(paired)), destinationRelatedDestinations: rels(unique(related)),
    destinationContinueHeading: choose(page.destinationContinueHeading, `Continue Exploring ${group}`), destinationEditorsPicksHeading: choose(page.destinationEditorsPicksHeading, 'Editor’s Picks'),
    destinationFeaturedGuideLabel: spotlight ? choose(page.destinationFeaturedGuideLabel, 'Featured Guide') : page.destinationFeaturedGuideLabel, destinationGuidesHeading: choose(page.destinationGuidesHeading, `${page.title} Guides`),
    destinationFeaturedStories: rels(unique([first, second])), destinationFeatureStory: rel(spotlight),
    destinationFeaturedOneImage: rel(page.destinationFeaturedOneImage || storyImage(first)), destinationFeaturedTwoImage: rel(page.destinationFeaturedTwoImage || storyImage(second)), destinationFeatureStoryImage: rel(page.destinationFeatureStoryImage || storyImage(spotlight)),
    destinationGuideStories: rels(page.destinationGuideStories.length ? page.destinationGuideStories : stories.slice(0, 12))
  };
}

function continentInput(page, locationsByTitle, continentFacts) {
  for (const field of ['locations','destinationFeaturedStories','destinationGuideStories','continentMostRequestedStories','continentContinueDestinations']) page[field] = page[field] || [];
  const defaults = { Europe:'Greece', 'North America':'California', Oceania:'French Polynesia', Asia:'Thailand', 'South America':'Argentina', Africa:'South Africa', 'Middle East':'Oman' };
  const requested = page.continentMostRequestedDestination || locationsByTitle.get(defaults[page.name]);
  const requestedStories = page.continentMostRequestedStories.length ? page.continentMostRequestedStories : ((requested && requested.storySet && requested.storySet.items) || []);
  const allStories = page.locations.flatMap((location) => (location.storySet && location.storySet.items) || []);
  const first = page.destinationFeaturedStories[0] || allStories[0];
  const second = page.destinationFeaturedStories[1] || allStories[1];
  const spotlight = page.destinationFeatureStory || allStories[2];
  const group = page.name === 'South America' ? 'South and Central America' : page.name === 'Africa' ? 'Africa and the Middle East' : page.name === 'Middle East' ? 'Middle East and Africa' : page.name;
  const specialNames = page.name === 'South America' ? ['Argentina','Uruguay','Panama','Costa Rica','Belize','Mexico'] : page.name === 'Africa' ? ['Ethiopia','Morocco','South Africa','Maldives','Oman','United Arab Emirates'] : page.name === 'Middle East' ? ['Oman','United Arab Emirates','Ethiopia','Morocco','South Africa'] : [];
  const continueItems = page.continentContinueDestinations.length ? page.continentContinueDestinations : (specialNames.length ? specialNames.map((name) => locationsByTitle.get(name)) : page.locations);
  const facts = continentFacts[page.name] || {};
  return {
    _id: page._id,
    destinationHeroImage: rel(page.destinationHeroImage || (page.social && page.social.image) || (page.locations[0] && (page.locations[0].destinationHeroImage || page.locations[0].image)) || storyImage(first)),
    destinationBlurb: choose(page.destinationBlurb, page.social && page.social.description, `Explore ${page.name} through our travel guides, destination notes, and firsthand stories.`),
    continentGeographyHeading: choose(page.continentGeographyHeading, 'Regions and Geography'), continentGeographyCards: choose(page.continentGeographyCards, facts.geography),
    continentSeasonsHeading: choose(page.continentSeasonsHeading, 'Travel Seasons by Region'), continentSeasonCards: choose(page.continentSeasonCards, facts.seasons), continentMapHeading: choose(page.continentMapHeading, 'Explore the Map'),
    continentMapBackgroundImage: rel(page.continentMapBackgroundImage || page.destinationHeroImage || (page.social && page.social.image) || storyImage(first)),
    continentMostRequestedLabel: choose(page.continentMostRequestedLabel, 'Most Requested'), continentMostRequestedDestination: rel(requested),
    continentMostRequestedTitle: choose(page.continentMostRequestedTitle, requested && `The Best of ${requested.title}`),
    continentMostRequestedDescription: choose(page.continentMostRequestedDescription, requested && requested.destinationBlurb, requested && `Start with four of our most requested ${requested.title} travel stories.`),
    continentMostRequestedStories: rels(requestedStories), continentContinueDestinations: rels(unique(continueItems)),
    destinationContinueHeading: choose(page.destinationContinueHeading, `Continue Exploring ${group}`), destinationEditorsPicksHeading: choose(page.destinationEditorsPicksHeading, 'Editor’s Picks'),
    destinationFeaturedGuideLabel: choose(page.destinationFeaturedGuideLabel, 'Featured Guide'), destinationGuidesHeading: choose(page.destinationGuidesHeading, `${page.name} Guides`),
    destinationFeaturedStories: rels(unique([first, second])), destinationFeatureStory: rel(spotlight),
    destinationFeaturedOneImage: rel(page.destinationFeaturedOneImage || storyImage(first)), destinationFeaturedTwoImage: rel(page.destinationFeaturedTwoImage || storyImage(second)), destinationFeatureStoryImage: rel(page.destinationFeatureStoryImage || storyImage(spotlight)),
    destinationGuideStories: rels(page.destinationGuideStories.length ? page.destinationGuideStories : allStories.slice(0, 12))
  };
}

function compact(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null && value !== undefined));
}

async function update(type, input) {
  const mutation = `mutation Backfill($input: Update${type}Input!) { update${type}(input:$input) { result { _id } } }`;
  return request(mutation, { input: compact(input) });
}

(async () => {
  const data = await request(inventoryQuery);
  const snapshotDir = path.join(root, '.migration-backups');
  const snapshotPath = path.join(snapshotDir, 'editor-content-before-backfill.json');
  fs.mkdirSync(snapshotDir, { recursive: true });
  if (!fs.existsSync(snapshotPath)) fs.writeFileSync(snapshotPath, JSON.stringify(data, null, 2));
  const locationsByTitle = new Map(data.locations.items.map((item) => [item.title, item]));
  const facts = parseDestinationFacts();
  const continentFacts = parseContinentFacts();
  const changes = [
    ...data.categories.items.map((item) => ({ type: 'Category', title: item.title, input: categoryInput(item) })),
    ...data.locations.items.map((item) => ({ type: 'Location', title: item.title, input: locationInput(item, locationsByTitle, facts) })),
    ...data.continents.items.map((item) => ({ type: 'Continent', title: item.name, input: continentInput(item, locationsByTitle, continentFacts) }))
  ];
  const report = changes.map((change) => ({ type: change.type, title: change.title, fields: Object.keys(compact(change.input)).filter((key) => key !== '_id') }));
  fs.writeFileSync(path.join(snapshotDir, 'editor-content-backfill-plan.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', counts: { categories: data.categories.items.length, destinations: data.locations.items.length, continents: data.continents.items.length }, records: changes.length, backup: snapshotPath }, null, 2));
  if (!apply) return;
  const skipped = [];
  for (const change of changes) {
    try {
      await update(change.type, change.input);
      console.log(`Backfilled ${change.type}: ${change.title}`);
    } catch (error) {
      if (/it is locked/i.test(error.message)) {
        skipped.push({ type: change.type, title: change.title, reason: 'locked' });
        console.warn(`Skipped locked ${change.type}: ${change.title}`);
        continue;
      }
      throw error;
    }
  }
  fs.writeFileSync(path.join(snapshotDir, 'editor-content-backfill-skipped.json'), JSON.stringify(skipped, null, 2));
  console.log(JSON.stringify({ completed: changes.length - skipped.length, skipped }, null, 2));
})();
