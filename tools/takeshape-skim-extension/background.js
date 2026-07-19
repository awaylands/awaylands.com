'use strict';

let storyTitlesCache = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'awaylands-story-titles') {
    return false;
  }

  if (storyTitlesCache) {
    sendResponse({ items: storyTitlesCache });
    return false;
  }

  fetch('https://www.awaylands.com/story-titles.json', { credentials: 'omit' })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Story title request failed with ${response.status}`);
      }

      return response.json();
    })
    .then(items => {
      storyTitlesCache = Array.isArray(items) ? items : [];
      sendResponse({ items: storyTitlesCache });
    })
    .catch(error => sendResponse({ items: [], error: error.message }));

  return true;
});
