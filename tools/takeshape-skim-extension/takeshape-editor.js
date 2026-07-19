(function () {
  'use strict';

  const ROOT_CLASS = 'awaylands-takeshape-skim';
  const SECTION_CLASS = 'awaylands-editor-section-title';
  const CONTENT_CLASS = 'awaylands-editor-content-title';
  const IMPORTANT_FIELD_CLASS = 'awaylands-editor-important-field';
  const OPTIONAL_FIELD_CLASS = 'awaylands-editor-optional-field';
  const CONVERTER_CLASS = 'awaylands-revolve-converter';
  const pendingRevolveFrames = [];

  function normalizedText(element) {
    return (element.textContent || '').replace(/\s+/g, ' ').trim();
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

    document.querySelectorAll('h4').forEach(heading => {
      const text = normalizedText(heading);

      heading.classList.add(SECTION_CLASS);
      heading.classList.toggle(CONTENT_CLASS, text === 'Content' || text.indexOf('Content Block') === 0);
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
