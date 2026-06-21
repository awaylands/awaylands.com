import 'whatwg-fetch';

const MAX_RESULTS = 24;

function normalize(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[^;\s]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textFromStory(story) {
  return normalize([
    story.title,
    story.category,
    story.location,
    story.dek,
    story.content,
    (story.mainBlocks || []).join(' '),
    (story.blocks || []).join(' ')
  ].join(' '));
}

function scoreStory(story, terms) {
  const title = normalize(story.title);
  const category = normalize(story.category);
  const location = normalize(story.location);
  const dek = normalize(story.dek);
  const text = story.searchText;
  let score = 0;

  terms.forEach(term => {
    if (title.indexOf(term) !== -1) {
      score += 12;
    }

    if (location.indexOf(term) !== -1) {
      score += 8;
    }

    if (category.indexOf(term) !== -1) {
      score += 6;
    }

    if (dek.indexOf(term) !== -1) {
      score += 4;
    }

    if (text.indexOf(term) !== -1) {
      score += 1;
    }
  });

  return score;
}

function createRubric(story) {
  return [story.location, story.category, story.date].filter(Boolean).join(' / ');
}

function getQueryParam(name) {
  const match = window.location.search.match(new RegExp(`[?&]${name}=([^&]*)`));

  return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
}

function addScore(story, score) {
  const scoredStory = {};

  Object.keys(story).forEach(key => {
    scoredStory[key] = story[key];
  });

  scoredStory.score = score;

  return scoredStory;
}

function renderResults(elements, results) {
  elements.results.innerHTML = '';

  results.forEach(story => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    const content = document.createElement('div');
    const rubric = document.createElement('div');
    const title = document.createElement('h2');
    const dek = document.createElement('p');

    item.className = 'search-results__item';
    link.className = 'search-result';
    content.className = 'search-result__content';
    rubric.className = 'search-result__rubric';
    title.className = 'search-result__title';
    dek.className = 'search-result__dek';

    link.href = story.url;
    rubric.textContent = createRubric(story);
    title.textContent = story.title;
    dek.textContent = story.dek || '';

    if (story.image) {
      const imageWrap = document.createElement('div');
      const image = document.createElement('img');

      imageWrap.className = 'search-result__image-wrap';
      image.className = 'search-result__image';
      image.src = story.image;
      image.alt = story.title;
      imageWrap.appendChild(image);
      link.appendChild(imageWrap);
    }

    content.appendChild(rubric);
    content.appendChild(title);
    content.appendChild(dek);
    link.appendChild(content);
    item.appendChild(link);
    elements.results.appendChild(item);
  });
}

function updateSearch(elements, stories) {
  const query = normalize(elements.input.value);

  if (!query) {
    elements.status.textContent = 'Start typing to search Away Lands.';
    elements.results.innerHTML = '';
    return;
  }

  const terms = query.split(' ').filter(term => term.length > 1);
  const results = stories
    .map(story => addScore(story, scoreStory(story, terms)))
    .filter(story => story.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  elements.status.textContent = results.length
    ? `${results.length} result${results.length === 1 ? '' : 's'} for "${elements.input.value}"`
    : `No results for "${elements.input.value}"`;

  renderResults(elements, results);
}

export default function initSearch() {
  const root = document.querySelector('[data-search-page]');

  if (!root) {
    return;
  }

  const elements = {
    form: root.querySelector('[data-search-form]'),
    input: root.querySelector('[data-search-input]'),
    results: root.querySelector('[data-search-results]'),
    status: root.querySelector('[data-search-status]')
  };

  const initialQuery = getQueryParam('q');

  elements.input.value = initialQuery;
  elements.status.textContent = 'Loading search...';

  fetch('/search.json')
    .then(res => res.json())
    .then(stories => {
      const searchableStories = stories.map(story => {
        story.searchText = textFromStory(story);

        return story;
      });

      elements.input.addEventListener('input', () => updateSearch(elements, searchableStories));
      elements.form.addEventListener('submit', event => {
        event.preventDefault();
        updateSearch(elements, searchableStories);
        window.history.replaceState(null, '', `/search/?q=${encodeURIComponent(elements.input.value)}`);
      });

      updateSearch(elements, searchableStories);
      elements.input.focus();
    })
    .catch(() => {
      elements.status.textContent = 'Search is temporarily unavailable.';
    });
}
