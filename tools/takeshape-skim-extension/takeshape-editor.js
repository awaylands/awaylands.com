(function () {
  'use strict';

  const ROOT_CLASS = 'awaylands-takeshape-skim';
  const SECTION_CLASS = 'awaylands-editor-section-title';
  const CONTENT_CLASS = 'awaylands-editor-content-title';
  const IMPORTANT_FIELD_CLASS = 'awaylands-editor-important-field';
  const OPTIONAL_FIELD_CLASS = 'awaylands-editor-optional-field';

  function normalizedText(element) {
    return (element.textContent || '').replace(/\s+/g, ' ').trim();
  }

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
