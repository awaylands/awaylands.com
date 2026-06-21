import 'whatwg-fetch';

const MAX_RESULTS = 24;
const SNIPPET_RADIUS = 90;

function normalize(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[^;\s]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function plainText(value) {
  return (value || '')
    .toString()
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

function createSearchFields(story) {
  return [
    { label: 'title', text: story.title || '' },
    { label: 'description', text: story.dek || '' },
    { label: 'location', text: story.location || '' },
    { label: 'category', text: story.category || '' },
    { label: 'post', text: plainText(story.content) },
    { label: 'post', text: plainText((story.mainBlocks || []).join(' ')) },
    { label: 'post', text: plainText((story.blocks || []).join(' ')) }
  ];
}

function createSnippet(story, terms) {
  const fields = story.searchFields || createSearchFields(story);

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const normalizedField = normalize(field.text);

    for (let j = 0; j < terms.length; j += 1) {
      const term = terms[j];

      if (normalizedField.indexOf(term) !== -1) {
        const originalText = field.text.replace(/\s+/g, ' ').trim();
        const originalIndex = originalText.toLowerCase().indexOf(term);
        const start = Math.max(0, originalIndex - SNIPPET_RADIUS);
        const end = Math.min(originalText.length, originalIndex + term.length + SNIPPET_RADIUS);

        return {
          label: field.label,
          text: `${start > 0 ? '...' : ''}${originalText.slice(start, end)}${end < originalText.length ? '...' : ''}`,
          term
        };
      }
    }
  }

  return null;
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

function appendHighlightedText(element, text, term) {
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(term);

  if (index === -1) {
    element.textContent = text;
    return;
  }

  element.appendChild(document.createTextNode(text.slice(0, index)));

  const mark = document.createElement('mark');
  mark.textContent = text.slice(index, index + term.length);
  element.appendChild(mark);

  element.appendChild(document.createTextNode(text.slice(index + term.length)));
}

function renderResults(elements, results, terms) {
  elements.results.innerHTML = '';

  results.forEach(story => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    const content = document.createElement('div');
    const rubric = document.createElement('div');
    const title = document.createElement('h2');
    const dek = document.createElement('p');
    const snippet = createSnippet(story, terms);

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

    if (snippet && snippet.text) {
      const reason = document.createElement('p');
      const label = document.createElement('span');

      reason.className = 'search-result__reason';
      label.className = 'search-result__reason-label';
      label.textContent = `Matched in ${snippet.label}: `;
      reason.appendChild(label);
      appendHighlightedText(reason, snippet.text, snippet.term);
      content.appendChild(reason);
    }

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

  renderResults(elements, results, terms);
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
        story.searchFields = createSearchFields(story);

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
