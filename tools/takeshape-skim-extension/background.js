'use strict';

let storyTitlesCache = null;
let storyTitlesCachedAt = 0;
const STORY_TITLES_CACHE_TTL = 5 * 60 * 1000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'awaylands-story-titles') {
    return false;
  }

  if (storyTitlesCache && Date.now() - storyTitlesCachedAt < STORY_TITLES_CACHE_TTL) {
    sendResponse({ items: storyTitlesCache });
    return false;
  }

  fetch(`https://www.awaylands.com/story-titles.json?extension=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'omit'
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Story title request failed with ${response.status}`);
      }

      return response.json();
    })
    .then(items => {
      storyTitlesCache = Array.isArray(items) ? items : [];
      storyTitlesCachedAt = Date.now();
      sendResponse({ items: storyTitlesCache });
    })
    .catch(error => sendResponse({ items: [], error: error.message }));

  return true;
});
