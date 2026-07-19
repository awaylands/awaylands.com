(function () {
  'use strict';

  const ROOT_CLASS = 'awaylands-takeshape-skim';
  const SECTION_CLASS = 'awaylands-editor-section-title';
  const CONTENT_CLASS = 'awaylands-editor-content-title';
  const IMPORTANT_FIELD_CLASS = 'awaylands-editor-important-field';
  const OPTIONAL_FIELD_CLASS = 'awaylands-editor-optional-field';
  const CONVERTER_CLASS = 'awaylands-revolve-converter';
  const SECTION_BOX_CLASS = 'awaylands-editor-section-box';
  const RELATED_RESULTS_CLASS = 'awaylands-related-results';
  const pendingRevolveFrames = [];
  let storyTitleIndex = null;
  let storyTitleRequest = null;

  function normalizedText(element) {
    return (element.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function storyForm() {
    const storyHeading = Array.from(document.querySelectorAll('h4')).find(heading => normalizedText(heading) === 'Story');
    let box = storyHeading;

    for (let depth = 0; box && depth < 3; depth += 1) {
      box = box.parentElement;
    }

    const form = box && box.children[1] && box.children[1].firstElementChild;

    return form && form.children.length >= 15 ? form : null;
  }

  function createSectionBox(title, fields, defaultOpen) {
    if (!fields.length || fields.some(field => field.closest(`.${SECTION_BOX_CLASS}`))) {
      return;
    }

    const section = document.createElement('section');
    const toggle = document.createElement('button');
    const body = document.createElement('div');
    const indicator = document.createElement('span');
    const first = fields[0];

    section.className = SECTION_BOX_CLASS;
    section.setAttribute('data-section', title.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    toggle.type = 'button';
    toggle.className = 'awaylands-editor-section-toggle';
    toggle.setAttribute('aria-expanded', defaultOpen ? 'true' : 'false');
    toggle.appendChild(document.createTextNode(title));
    indicator.className = 'awaylands-editor-section-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    toggle.appendChild(indicator);
    body.className = 'awaylands-editor-section-body';
    body.hidden = !defaultOpen;
    first.parentNode.insertBefore(section, first);
    section.appendChild(toggle);
    section.appendChild(body);
    fields.forEach(field => body.appendChild(field));
    toggle.addEventListener('click', () => {
      const open = body.hidden;

      body.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function groupMajorSections() {
    const form = storyForm();

    if (!form || form.querySelector(`.${SECTION_BOX_CLASS}`)) {
      return;
    }

    form.classList.add('awaylands-editor-section-grid');
    const fields = Array.from(form.children);

    if (fields.length < 19) {
      return;
    }

    createSectionBox('Story', fields.slice(0, 3), true);
    createSectionBox('Tout', fields.slice(3, 7), true);
    createSectionBox('Content', fields.slice(7, 9), true);
    createSectionBox('Post Layout', fields.slice(9, 11), true);
    createSectionBox('At a Glance', fields.slice(11, 12), true);
    createSectionBox('Shop the Edit', fields.slice(12, 15), true);
    createSectionBox('About the Author', fields.slice(15, 16), true);
    createSectionBox('Related Stories', fields.slice(16, 19), true);

    const storyHeading = Array.from(document.querySelectorAll('h4')).find(heading => normalizedText(heading) === 'Story');

    if (storyHeading) {
      storyHeading.closest('.MuiStack-root').classList.add('awaylands-editor-original-story-heading');
    }
  }

  function addContentBlockButtons() {
    const original = Array.from(document.querySelectorAll('button')).find(button => normalizedText(button) === 'Add Content Block');

    if (!original || original.parentNode.querySelector('.awaylands-content-block-buttons')) {
      return;
    }

    const row = document.createElement('div');
    const types = [
      ['Content', 'Content Block'],
      ['HTML', 'HTML Block'],
      ['Table', 'Table Block'],
      ['Image', 'Image — fast controls']
    ];

    row.className = 'awaylands-content-block-buttons';
    types.forEach(type => {
      const button = document.createElement('button');

      button.type = 'button';
      button.textContent = type[0];
      button.title = `Add ${type[1]}`;
      button.addEventListener('click', () => {
        original.click();
        window.requestAnimationFrame(() => {
          const option = Array.from(document.querySelectorAll('[role="menuitem"]')).find(item => normalizedText(item) === type[1]);

          if (option) {
            option.click();
          }
        });
      });
      row.appendChild(button);
    });
    original.parentNode.insertBefore(row, original);
    original.classList.add('awaylands-original-add-content');
  }

  function removeUnusedControls() {
    Array.from(document.querySelectorAll('[role="menuitem"]')).forEach(item => {
      if (/^Gallery\b/.test(normalizedText(item))) {
        item.hidden = true;
      }
    });

    document.querySelectorAll('label').forEach(label => {
      if (normalizedText(label).toLowerCase() !== 'credit') {
        return;
      }

      const field = label.closest('.MuiFormControl-root') || label.parentElement;

      if (field) {
        field.hidden = true;
        field.classList.add('awaylands-removed-credit-field');
      }
    });
  }

  function collapseAtAGlanceOptions() {
    const section = document.querySelector(`.${SECTION_BOX_CLASS}[data-section="at-a-glance"]`);
    const field = section && Array.from(section.querySelectorAll('h4')).find(heading => normalizedText(heading) === 'At a Glance');
    const container = field && field.closest('.MuiBox-root.css-1l6m9mh');

    if (!container || container.querySelector('.awaylands-at-a-glance-toggle') || !container.children[1]) {
      return;
    }

    const toggle = document.createElement('button');
    const options = container.children[1];

    toggle.type = 'button';
    toggle.className = 'awaylands-at-a-glance-toggle';
    toggle.textContent = 'Show custom options';
    toggle.setAttribute('aria-expanded', 'false');
    options.hidden = true;
    options.classList.add('awaylands-at-a-glance-options');
    container.insertBefore(toggle, options);
    toggle.addEventListener('click', () => {
      const open = options.hidden;

      options.hidden = !open;
      toggle.textContent = open ? 'Hide custom options' : 'Show custom options';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function shopItemMarkup(item) {
    const textarea = Array.from(item.querySelectorAll('textarea')).find(field => {
      const label = field.closest('.MuiFormControl-root') && field.closest('.MuiFormControl-root').querySelector('label');

      return label && /product embed html/i.test(normalizedText(label));
    });

    return textarea ? textarea.value.trim() : '';
  }

  function collapseShopItems() {
    const section = document.querySelector(`.${SECTION_BOX_CLASS}[data-section="shop-the-edit"]`);
    const heading = section && Array.from(section.querySelectorAll('h4')).find(item => /Shop The Edit/.test(normalizedText(item)));
    const field = heading && heading.closest('.MuiBox-root.css-1l6m9mh');
    const itemList = field && field.children[1] && field.children[1].children[0];

    if (!itemList) {
      return;
    }

    Array.from(itemList.children).forEach((item, index) => {
      if (item.querySelector(':scope > .awaylands-shop-item-toggle')) {
        return;
      }

      const toggle = document.createElement('button');
      const title = document.createElement('strong');
      const code = document.createElement('code');
      const markup = shopItemMarkup(item);

      item.classList.add('awaylands-shop-item', 'is-collapsed');
      toggle.type = 'button';
      toggle.className = 'awaylands-shop-item-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      title.textContent = `Item ${index + 1}`;
      code.textContent = markup || 'No product HTML added yet';
      toggle.appendChild(title);
      toggle.appendChild(code);
      item.insertBefore(toggle, item.firstChild);
      toggle.addEventListener('click', () => {
        const open = item.classList.contains('is-collapsed');

        item.classList.toggle('is-collapsed', !open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  function storyTitles() {
    if (storyTitleIndex) {
      return Promise.resolve(storyTitleIndex);
    }

    if (!storyTitleRequest) {
      storyTitleRequest = fetch('https://www.awaylands.com/story-titles.json', { credentials: 'omit' })
        .then(response => response.ok ? response.json() : [])
        .then(items => {
          storyTitleIndex = Array.isArray(items) ? items.filter(item => item && item.title) : [];
          return storyTitleIndex;
        })
        .catch(() => {
          storyTitleIndex = [];
          return storyTitleIndex;
        });
    }

    return storyTitleRequest;
  }

  function nativeInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function selectRelatedStory(input, title, results) {
    nativeInputValue(input, title);
    input.focus();
    let attempts = 0;
    const prefix = title.slice(0, 24).toLowerCase();
    const timer = window.setInterval(() => {
      const option = Array.from(document.querySelectorAll('[role="option"]')).find(item => normalizedText(item).toLowerCase().indexOf(prefix) !== -1);

      attempts += 1;
      if (option) {
        window.clearInterval(timer);
        option.click();
        results.hidden = true;
      } else if (attempts >= 20) {
        window.clearInterval(timer);
        results.innerHTML = '<p>TakeShape did not make this story selectable. The title is shown, but its publishing state may need to be enabled.</p>';
      }
    }, 100);
  }

  function renderRelatedResults(input, results, items) {
    const query = input.value.trim().toLowerCase();

    results.innerHTML = '';
    if (!query) {
      results.hidden = true;
      return;
    }

    const matches = items.filter(item => item.title.toLowerCase().indexOf(query) !== -1).slice(0, 60);

    if (!matches.length) {
      results.hidden = true;
      return;
    }

    const list = document.createElement('div');

    matches.forEach(item => {
      const button = document.createElement('button');

      button.type = 'button';
      button.textContent = item.title;
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => selectRelatedStory(input, item.title, results));
      list.appendChild(button);
    });
    results.appendChild(list);
    results.hidden = false;
  }

  function improveRelatedStorySearch() {
    const label = Array.from(document.querySelectorAll('label')).find(item => normalizedText(item) === 'Related Stories');
    const field = label && label.closest('.MuiFormControl-root');
    const input = field && field.querySelector('input[role="combobox"]');

    if (!field || !input || field.parentNode.querySelector(`.${RELATED_RESULTS_CLASS}`)) {
      return;
    }

    const results = document.createElement('div');

    results.className = RELATED_RESULTS_CLASS;
    results.hidden = true;
    field.parentNode.insertBefore(results, field.nextSibling);
    input.addEventListener('input', () => {
      storyTitles().then(items => renderRelatedResults(input, results, items));
    });
    input.addEventListener('focus', () => {
      storyTitles().then(items => renderRelatedResults(input, results, items));
    });
  }

  function setEditorValue(field, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;

    setter.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function productMarkup(product) {
    const link = document.createElement('a');

    link.href = product.url;
    link.setAttribute('data-awaylands-product', '');
    link.setAttribute('data-image', product.image);
    link.setAttribute('data-name', product.name);
    link.setAttribute('data-brand', product.brand || 'Revolve');
    link.setAttribute('data-price', product.price || '');
    return link.outerHTML;
  }

  function requestRevolveProduct(field, button) {
    const template = document.createElement('template');

    template.innerHTML = field.value || '';
    const sourceFrame = template.content.querySelector('iframe[src*="rvlv.me"]');

    if (!sourceFrame) {
      button.textContent = 'Paste a Revolve iframe first';
      return;
    }

    const preview = document.createElement('iframe');

    preview.src = sourceFrame.src;
    preview.hidden = true;
    preview.setAttribute('aria-hidden', 'true');
    preview.tabIndex = -1;
    pendingRevolveFrames.push({ preview, field, button });
    document.body.appendChild(preview);
    button.disabled = true;
    button.textContent = 'Building native card...';
    window.setTimeout(() => {
      const index = pendingRevolveFrames.findIndex(item => item.preview === preview);

      if (index === -1) {
        return;
      }

      pendingRevolveFrames.splice(index, 1);
      preview.remove();
      button.disabled = false;
      button.textContent = 'Try native card again';
    }, 16000);
  }

  function addRevolveConverter(label, field) {
    const textarea = field.querySelector('textarea');

    if (!textarea || field.querySelector(`.${CONVERTER_CLASS}`)) {
      return;
    }

    const button = document.createElement('button');

    button.type = 'button';
    button.className = CONVERTER_CLASS;
    if ((textarea.value || '').indexOf('data-awaylands-product') !== -1) {
      button.textContent = 'Native Away Lands card ready';
      button.disabled = true;
    } else {
      button.textContent = 'Convert Revolve embed to Away Lands card';
      button.addEventListener('click', () => requestRevolveProduct(textarea, button));
    }
    field.appendChild(button);
  }

  window.addEventListener('message', event => {
    if (!event.data || event.data.type !== 'awaylands-revolve-product') {
      return;
    }

    const index = pendingRevolveFrames.findIndex(item => item.preview.contentWindow === event.source);

    if (index === -1) {
      return;
    }

    const item = pendingRevolveFrames.splice(index, 1)[0];
    const product = event.data.product || {};

    if (!/^https:\/\/rvlv\.me\//i.test(product.url || '') || !/^https:\/\//i.test(product.image || '') || !product.name) {
      item.button.disabled = false;
      item.button.textContent = 'Could not read this Revolve product';
      item.preview.remove();
      return;
    }

    setEditorValue(item.field, productMarkup(product));
    item.preview.remove();
    item.button.textContent = 'Native Away Lands card ready';
  });

  function markEditorElements() {
    if (!document.body) {
      return;
    }

    document.body.classList.add(ROOT_CLASS);
    groupMajorSections();

    document.querySelectorAll('h4').forEach(heading => {
      const text = normalizedText(heading);

      heading.classList.add(SECTION_CLASS);
      heading.classList.toggle(CONTENT_CLASS, text === 'Content' || text.indexOf('Content Block') === 0 || text === 'Image' || text === 'Social');
    });

    document.querySelectorAll('label').forEach(label => {
      const text = normalizedText(label).toLowerCase();
      const field = label.closest('.MuiFormControl-root');

      if (!field) {
        return;
      }

      field.classList.toggle(
        IMPORTANT_FIELD_CLASS,
        text.indexOf('story') === 0 ||
          text.indexOf('post layout') === 0 ||
          text.indexOf('page layout') === 0 ||
          text.indexOf('section ') === 0 ||
          text === 'related stories'
      );
      field.classList.toggle(OPTIONAL_FIELD_CLASS, text.indexOf('optional') !== -1);
      if (text.indexOf('product embed html') !== -1) {
        addRevolveConverter(label, field);
      }
    });

    addContentBlockButtons();
    removeUnusedControls();
    collapseAtAGlanceOptions();
    collapseShopItems();
    improveRelatedStorySearch();
  }

  let frameRequested = false;
  const requestMarking = () => {
    if (frameRequested) {
      return;
    }

    frameRequested = true;
    window.requestAnimationFrame(() => {
      frameRequested = false;
      markEditorElements();
    });
  };

  markEditorElements();
  new MutationObserver(requestMarking).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}());
