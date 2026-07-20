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
  const CHOICE_GROUP_CLASS = 'awaylands-choice-group';
  const IMAGE_DIALOG_CLASS = 'awaylands-image-dialog';
  const HTML_INSERT_BUTTON_CLASS = 'awaylands-inline-html-button';
  const HTML_INSERT_DIALOG_CLASS = 'awaylands-inline-html-dialog';
  const INLINE_HTML_MARKER_PREFIX = 'AWAYLANDS_HTML';
  const pendingRevolveFrames = [];
  let storyTitleIndex = null;
  let storyTitleRequest = null;
  let htmlInsertState = null;
  const relatedSelectionInputs = new WeakSet();

  function normalizedText(element) {
    return (element.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function keepGallerySidebarUsable() {
    document.querySelectorAll('[class*="asset-picker-grid-module__grid"]').forEach(grid => {
      const sidebarContent = grid.closest('[class*="floating-sidebar-module__sidebarContent___"]');
      const sidebarShell = sidebarContent && sidebarContent.closest('[class*="floating-sidebar-module__sidebar___"]');

      if (!sidebarContent) {
        return;
      }

      sidebarContent.classList.add('awaylands-gallery-drawer-content');
      if (grid.parentElement) {
        grid.parentElement.classList.add('awaylands-gallery-flow-host');
      }
      if (sidebarShell) {
        sidebarShell.classList.add('awaylands-gallery-drawer-shell');
        if (sidebarShell.parentElement && sidebarShell.parentElement !== document.body) {
          sidebarShell.parentElement.classList.add('awaylands-gallery-layout-parent');
        }
      }
      const galleryTop = grid.getBoundingClientRect().top;
      const closeButtons = Array.from(sidebarContent.querySelectorAll('button')).filter(button => {
        const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''}`.toLowerCase();
        const rect = button.getBoundingClientRect();

        return label.indexOf('close') !== -1 || (
          !normalizedText(button) &&
          button.querySelector('svg') &&
          rect.bottom <= galleryTop - 12 &&
          button.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING
        );
      });
      if (closeButtons.length) closeButtons[0].classList.add('awaylands-gallery-native-close');

      if (!sidebarContent.hasAttribute('data-awaylands-persistent-gallery')) {
        sidebarContent.setAttribute('data-awaylands-persistent-gallery', 'true');
        sidebarContent.addEventListener('keydown', event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        }, true);
      }
    });
  }

  function tryOpenPersistentGallery() {
    if (document.querySelector('[class*="asset-picker-grid-module__grid"]')) {
      return;
    }

    const opener = Array.from(document.querySelectorAll('button')).find(button => {
      const names = [normalizedText(button), button.getAttribute('aria-label'), button.getAttribute('title')]
        .filter(Boolean)
        .map(name => name.trim().toLowerCase());

      return !button.hasAttribute('data-awaylands-gallery-open-attempt') && names.some(name => /^(assets|media|media library|open assets|open asset picker)$/.test(name));
    });

    if (opener) {
      opener.setAttribute('data-awaylands-gallery-open-attempt', 'true');
      opener.click();
    }
  }

  function topActionCandidate(pattern) {
    return Array.from(document.querySelectorAll('button')).find(button => {
      const rect = button.getBoundingClientRect();

      return !button.closest('[role="dialog"]') && rect.top < 180 && rect.bottom > 0 && pattern.test(normalizedText(button));
    });
  }

  function restoreNativePublishingStatus() {
    document.querySelectorAll('.awaylands-top-publishing-status, .awaylands-editor-action-dock').forEach(element => element.remove());
    document.querySelectorAll('.awaylands-native-save-source').forEach(button => button.classList.remove('awaylands-native-save-source'));
    document.querySelectorAll('.awaylands-native-status-source').forEach(element => element.classList.remove('awaylands-native-status-source'));
    document.querySelectorAll('.awaylands-native-status-input').forEach(element => element.classList.remove('awaylands-native-status-input'));
    document.querySelectorAll('.awaylands-native-status-container').forEach(element => element.classList.remove('awaylands-native-status-container'));
  }

  function makeStorySaveContinue() {
    if (!/\/data\/Story\//i.test(window.location.pathname)) {
      return;
    }

    const save = topActionCandidate(/^save$/i);

    if (!save || save.hasAttribute('data-awaylands-save-continue')) {
      return;
    }

    save.setAttribute('data-awaylands-save-continue', 'true');
    save.setAttribute('title', 'Save and continue editing this story');
    save.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const saveRect = save.getBoundingClientRect();
      const nearbyButtons = Array.from((save.parentElement || document).querySelectorAll('button')).filter(button => {
        if (button === save || button.closest('[role="dialog"], [role="menu"], [role="listbox"]')) {
          return false;
        }
        const rect = button.getBoundingClientRect();
        return Math.abs(rect.top - saveRect.top) < 8 && rect.left >= saveRect.right - 4 && rect.left <= saveRect.right + 90;
      });
      const menuToggle = nearbyButtons.find(button => button.getAttribute('aria-haspopup')) ||
        nearbyButtons.find(button => button.querySelector('svg') || !normalizedText(button));

      if (!menuToggle) {
        save.removeAttribute('data-awaylands-save-continue');
        save.setAttribute('title', 'Save menu was not available. Use the adjacent arrow and choose Save and Continue.');
        return;
      }

      menuToggle.click();
      let attempts = 0;
      const chooseContinue = window.setInterval(() => {
        const choices = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], [role="menu"] button, li button, li[role="button"]'));
        const continueChoice = choices.find(choice => /^save\s+(and|&)\s+(continue|keep editing|continue editing)$/i.test(normalizedText(choice)));

        attempts += 1;
        if (continueChoice) {
          window.clearInterval(chooseContinue);
          continueChoice.click();
        } else if (attempts >= 20) {
          window.clearInterval(chooseContinue);
          save.setAttribute('title', 'Choose Save and Continue from the open Save menu.');
        }
      }, 50);
    }, true);
  }

  function moveStoryToolsBelowGallery() {
    const galleryContent = document.querySelector('.awaylands-gallery-drawer-content');
    const galleryShell = document.querySelector('.awaylands-gallery-drawer-shell');

    if (!galleryContent || !galleryShell) {
      return;
    }

    const storyToolLabel = Array.from(document.querySelectorAll('button, h1, h2, h3, h4, h5, h6, label, [role="heading"], div, span'))
      .filter(element => !galleryContent.contains(element) && /^(workflow status|versions|version history|history)$/i.test(normalizedText(element)))
      .sort((first, second) => first.getBoundingClientRect().width - second.getBoundingClientRect().width)[0];

    if (!storyToolLabel) {
      return;
    }

    let panel = storyToolLabel.closest('aside, [class*="sidebar"]') ||
      storyToolLabel.closest('section, .MuiPaper-root, [class*="panel"]') ||
      storyToolLabel.parentElement;
    let completeColumn = null;

    const directChildWithin = (ancestor, descendant) => {
      let child = descendant;

      while (child && child.parentElement !== ancestor) {
        child = child.parentElement;
      }
      return child && child.parentElement === ancestor ? child : null;
    };

    let layoutAncestor = galleryShell.parentElement;
    let editorColumn = null;
    let levels = 0;

    while (layoutAncestor && layoutAncestor !== document.body && levels < 8) {
      const display = window.getComputedStyle(layoutAncestor).display;
      const galleryColumn = directChildWithin(layoutAncestor, galleryShell);
      const storyToolsColumn = directChildWithin(layoutAncestor, storyToolLabel);

      if (
        (display === 'flex' || display === 'grid') &&
        galleryColumn &&
        storyToolsColumn &&
        galleryColumn !== storyToolsColumn &&
        !storyToolsColumn.querySelector('textarea, [contenteditable="true"]')
      ) {
        completeColumn = storyToolsColumn;
        editorColumn = Array.prototype.slice.call(layoutAncestor.children).find(child => (
          child !== galleryColumn &&
          child !== storyToolsColumn &&
          !!child.querySelector('textarea, [contenteditable="true"]')
        )) || null;
        break;
      }
      layoutAncestor = layoutAncestor.parentElement;
      levels += 1;
    }

    if (!completeColumn) {
      const galleryRect = galleryShell.getBoundingClientRect();
      const geometricCandidates = [];
      let candidate = storyToolLabel.parentElement;
      let candidateLevels = 0;

      while (candidate && candidate !== document.body && candidateLevels < 10) {
        const rect = candidate.getBoundingClientRect();
        const reachesGallery = Math.abs(rect.right - galleryRect.left) <= 24;
        const isFullHeightPanel = rect.height >= Math.max(500, window.innerHeight * 0.7);
        const isSidebarWidth = rect.width >= 220 && rect.width <= 620;
        const containsEditor = !!candidate.querySelector('textarea, [contenteditable="true"]');

        if (reachesGallery && isFullHeightPanel && isSidebarWidth && !containsEditor && !candidate.contains(galleryShell)) {
          geometricCandidates.push(candidate);
        }
        candidate = candidate.parentElement;
        candidateLevels += 1;
      }
      completeColumn = geometricCandidates.sort((first, second) => second.getBoundingClientRect().width - first.getBoundingClientRect().width)[0] || null;
    }

    if (completeColumn) {
      panel = completeColumn;
    }

    if (!panel || panel === document.body || panel.contains(galleryContent)) {
      return;
    }

    if (!editorColumn) {
      const layoutParent = galleryShell.parentElement;
      const galleryColumn = layoutParent && directChildWithin(layoutParent, galleryShell);

      editorColumn = layoutParent && Array.prototype.slice.call(layoutParent.children).find(child => (
        child !== galleryColumn &&
        child !== completeColumn &&
        !!child.querySelector('textarea, [contenteditable="true"]')
      ));
    }

    if (!editorColumn) {
      return;
    }

    let tools = document.querySelector('.awaylands-left-story-tools, .awaylands-gallery-story-tools');

    if (!tools) {
      tools = document.createElement('section');
      const heading = document.createElement('h3');
      tools.className = 'awaylands-left-story-tools';
      heading.textContent = 'Story tools and versions';
      tools.appendChild(heading);
    } else {
      tools.classList.remove('awaylands-gallery-story-tools');
      tools.classList.add('awaylands-left-story-tools');
    }
    if (!tools.hasAttribute('data-awaylands-preserved-width')) {
      const panelWidth = Math.round(panel.getBoundingClientRect().width);

      if (panelWidth > 0) {
        tools.style.width = `${panelWidth}px`;
        tools.style.maxWidth = '100%';
      }
      tools.setAttribute('data-awaylands-preserved-width', 'true');
    }
    if (tools.parentElement !== editorColumn) {
      editorColumn.appendChild(tools);
    }
    if (!tools.contains(panel)) {
      panel.classList.add('awaylands-story-tools-panel');
      tools.appendChild(panel);
    }
  }

  function removeBottomEditorBar() {
    const excludedOverlay = '[role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"], .awaylands-inline-html-dialog';

    const remove = element => {
      if (element && element !== document.body && element !== document.documentElement && !element.closest(excludedOverlay)) {
        element.classList.add('awaylands-remove-bottom-bar');
      }
    };

    const publishSiteLabels = Array.from(document.querySelectorAll('button, a, div, span'))
      .filter(element => /^publish site$/i.test(normalizedText(element)))
      .sort((first, second) => first.getBoundingClientRect().width - second.getBoundingClientRect().width);

    publishSiteLabels.forEach(label => {
      let ancestor = label;
      let levels = 0;
      const bottomBarCandidates = [];

      while (ancestor && ancestor !== document.body && levels < 10) {
        const style = window.getComputedStyle(ancestor);
        const rect = ancestor.getBoundingClientRect();
        if (style.position === 'fixed' || style.position === 'sticky') {
          remove(ancestor);
          return;
        }
        if (rect.width >= 200 && rect.height > 0 && rect.height <= 220 && rect.bottom >= window.innerHeight - 100) {
          bottomBarCandidates.push(ancestor);
        }
        ancestor = ancestor.parentElement;
        levels += 1;
      }
      const widestBottomBar = bottomBarCandidates.sort((first, second) => second.getBoundingClientRect().width - first.getBoundingClientRect().width)[0];
      if (widestBottomBar) remove(widestBottomBar);
    });

    Array.from(document.querySelectorAll('body *')).forEach(element => {
      if (element.closest(excludedOverlay)) {
        return;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const nearViewportEdge = rect.top <= 80 || rect.bottom >= window.innerHeight - 80;
      const isEditorChrome = rect.width >= 200 && rect.height > 0 && rect.height <= 240 && nearViewportEdge;

      const hasInteractiveContent = !!element.querySelector('button, a, input, textarea, select, [role="button"]');
      const isEmptyTopChrome = (
        rect.top <= 180 &&
        rect.bottom <= 300 &&
        rect.width >= window.innerWidth * 0.5 &&
        !normalizedText(element) &&
        !hasInteractiveContent
      );

      if (
        isEmptyTopChrome &&
        (style.position === 'sticky' || style.position === 'fixed' || element.classList.contains('awaylands-editor-nonsticky'))
      ) {
        element.classList.remove('awaylands-editor-nonsticky');
        element.classList.add('awaylands-remove-empty-sticky-bar');
      } else if (style.position === 'sticky' || (style.position === 'fixed' && isEditorChrome)) {
        element.classList.add('awaylands-editor-nonsticky');
      }
    });
  }

  function enableStoryOnOpen() {
    if (!/\/data\/Story\//i.test(window.location.pathname)) {
      return;
    }

    const workflowLabel = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, label, div, span'))
      .filter(element => /^workflow status$/i.test(normalizedText(element)))
      .sort((first, second) => first.getBoundingClientRect().width - second.getBoundingClientRect().width)[0];
    const workflowPanel = workflowLabel && (
      workflowLabel.closest('.awaylands-story-tools-panel, aside, section, [class*="sidebar"], [class*="panel"]') ||
      workflowLabel.parentElement
    );

    if (!workflowPanel || workflowPanel.hasAttribute('data-awaylands-auto-enabled')) {
      return;
    }

    const enabledText = Array.from(workflowPanel.querySelectorAll('button, label, [role="radio"], [role="option"], div, span'))
      .filter(element => /^enabled$/i.test(normalizedText(element)))
      .sort((first, second) => first.getBoundingClientRect().width - second.getBoundingClientRect().width)[0];
    const enabledControl = enabledText && (
      enabledText.closest('button, label, [role="radio"], [role="option"]') ||
      enabledText.querySelector('input') ||
      enabledText
    );
    const enabledInput = enabledControl && (
      enabledControl.matches('input') ? enabledControl : enabledControl.querySelector('input[type="radio"], input[type="checkbox"]')
    );
    const enabledSelected = !!(
      (enabledInput && enabledInput.checked) ||
      (enabledControl && enabledControl.getAttribute('aria-checked') === 'true') ||
      (enabledControl && enabledControl.getAttribute('aria-pressed') === 'true') ||
      (enabledControl && /(^|\s)(active|checked|selected)(\s|$)/i.test(enabledControl.className || ''))
    );

    workflowPanel.setAttribute('data-awaylands-auto-enabled', 'true');
    if (enabledSelected) {
      return;
    }

    if (enabledInput) {
      enabledInput.click();
    } else if (enabledControl && typeof enabledControl.click === 'function') {
      enabledControl.click();
    }
  }

  function clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function showElementMessage(element, message) {
    const paragraph = document.createElement('p');

    paragraph.textContent = message;
    clearElement(element);
    element.appendChild(paragraph);
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

    const toutSection = form.querySelector(`.${SECTION_BOX_CLASS}[data-section="tout"]`);
    const toutBody = toutSection && toutSection.querySelector('.awaylands-editor-section-body');
    const postLayoutSection = form.querySelector(`.${SECTION_BOX_CLASS}[data-section="post-layout"]`);
    const socialField = fields[6];

    if (toutBody && postLayoutSection && socialField && socialField.parentElement === toutBody) {
      toutBody.insertBefore(postLayoutSection, socialField);
    }

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
      ['+ Content', 'Content Block'],
      ['+ HTML', 'HTML Block'],
      ['+ Table', 'Table Block']
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

  function contentEditorHost(editor) {
    const host = editor && editor.closest('[data-testid^="contentForm-"]');
    const testId = host && host.getAttribute('data-testid');

    if (testId === 'contentForm-content' || /^contentForm-contentBlocks\[\d+\]\.content$/.test(testId || '')) {
      return host;
    }

    return null;
  }

  function contentEditors() {
    return Array.from(document.querySelectorAll('[contenteditable="true"][role="textbox"]')).filter(contentEditorHost);
  }

  function looksLikeHtml(value) {
    const html = (value || '').trim();

    return html.length > 2 && (
      /^<!doctype\s+html/i.test(html) ||
      /^<!--/.test(html) ||
      /^<\/?[a-z][\s\S]*>/i.test(html)
    );
  }

  function htmlValidationMessage(value) {
    const html = (value || '').trim();

    if (!html) {
      return 'Paste HTML to continue.';
    }
    if (!looksLikeHtml(html)) {
      return 'This does not look like HTML yet.';
    }
    if (/<\/?(?:html|head|body)(?:\s|>)/i.test(html)) {
      return 'Paste the embed or element only, without HTML, HEAD, or BODY tags.';
    }

    return '';
  }

  function currentEditorSelection(editor) {
    const selection = window.getSelection();

    if (!selection || !selection.rangeCount || !editor.contains(selection.anchorNode)) {
      return null;
    }

    return selection.getRangeAt(0).cloneRange();
  }

  function insertMarkerAtSelection(editor, range, marker) {
    const selection = window.getSelection();

    if (!editor || !range || !selection) {
      return false;
    }

    editor.focus();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('insertParagraph', false, null);
    const inserted = document.execCommand('insertText', false, `[[${INLINE_HTML_MARKER_PREFIX}:${marker}]]`);

    document.execCommand('insertParagraph', false, null);
    return inserted;
  }

  function htmlTextareas() {
    return Array.from(document.querySelectorAll('textarea')).filter(textarea => {
      const field = textarea.closest('.MuiFormControl-root');
      const label = field && field.querySelector('label');

      return !textarea.readOnly &&
        textarea.getAttribute('aria-hidden') !== 'true' &&
        label &&
        normalizedText(label) === 'HTML' &&
        textarea.closest('[data-testid^="array-field-item-contentBlocks["]');
    });
  }

  function waitForNewHtmlTextarea(previousFields, callback, attempts) {
    const field = htmlTextareas().find(textarea => !previousFields.has(textarea));

    if (field) {
      callback(field);
      return;
    }
    if (attempts <= 0) {
      callback(null);
      return;
    }

    window.setTimeout(() => waitForNewHtmlTextarea(previousFields, callback, attempts - 1), 100);
  }

  function waitForMenuItem(title, callback, attempts) {
    const option = Array.from(document.querySelectorAll('[role="menuitem"]')).find(item => normalizedText(item) === title);

    if (option) {
      callback(option);
      return;
    }
    if (attempts <= 0) {
      callback(null);
      return;
    }

    window.setTimeout(() => waitForMenuItem(title, callback, attempts - 1), 100);
  }

  function createNativeHtmlBlock(value, marker, callback) {
    const addButton = document.querySelector('[data-testid="contentForm-contentBlocks-add"]') ||
      Array.from(document.querySelectorAll('button')).find(button => normalizedText(button) === 'Add Content Block');
    const previousFields = new Set(htmlTextareas());

    if (!addButton) {
      callback(false, 'TakeShape’s Add Content Block control could not be found.');
      return;
    }

    addButton.click();
    waitForMenuItem('HTML Block', option => {
      if (!option) {
        callback(false, 'TakeShape’s HTML Block option did not open.');
        return;
      }

      option.click();
      waitForNewHtmlTextarea(previousFields, textarea => {
        if (!textarea) {
          callback(false, 'The new HTML Block could not be filled.');
          return;
        }

        setEditorValue(textarea, `<div data-awaylands-inline-html="${marker}">${value.trim()}</div>`);
        textarea.closest('[data-testid^="array-field-item-contentBlocks["]').classList.add('awaylands-new-inline-html-block');
        window.setTimeout(decorateInlineHtmlMarkers, 0);
        callback(true, textarea);
      }, 30);
    }, 30);
  }

  function closeHtmlInsertDialog() {
    const dialog = document.querySelector(`.${HTML_INSERT_DIALOG_CLASS}`);

    if (dialog) {
      const preview = dialog.querySelector('.awaylands-inline-html-preview');

      if (preview && preview._awaylandsPreviewUrl) {
        URL.revokeObjectURL(preview._awaylandsPreviewUrl);
      }
      dialog.remove();
    }
    htmlInsertState = null;
  }

  function updateHtmlPreview(dialog) {
    const textarea = dialog.querySelector('.awaylands-inline-html-source');
    const preview = dialog.querySelector('.awaylands-inline-html-preview');
    const message = dialog.querySelector('.awaylands-inline-html-message');
    const insert = dialog.querySelector('.awaylands-inline-html-insert');
    const validation = htmlValidationMessage(textarea.value);

    message.textContent = validation || 'Ready to insert as a native HTML block at the selected position.';
    message.classList.toggle('is-error', Boolean(validation));
    insert.disabled = Boolean(validation);
    if (preview._awaylandsPreviewUrl) {
      URL.revokeObjectURL(preview._awaylandsPreviewUrl);
    }
    preview._awaylandsPreviewUrl = URL.createObjectURL(new Blob([
      '<!doctype html><style>body{margin:16px;font:14px Arial,sans-serif;color:#333}img,iframe,video{max-width:100%}</style>',
      textarea.value
    ], { type: 'text/html' }));
    preview.src = preview._awaylandsPreviewUrl;
  }

  function storedInlineHtml(textarea, marker) {
    const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = (textarea.value || '').match(new RegExp(`^\\s*<div\\b[^>]*data-awaylands-inline-html=["']${escapedMarker}["'][^>]*>([\\s\\S]*)<\\/div>\\s*$`, 'i'));

    return match ? match[1] : textarea.value;
  }

  function openHtmlInsertDialog(editor, value, source, existingTextarea, existingMarker) {
    closeHtmlInsertDialog();

    const range = currentEditorSelection(editor);
    const dialog = document.createElement('div');
    const backdrop = document.createElement('div');
    const panel = document.createElement('section');
    const header = document.createElement('header');
    const headingGroup = document.createElement('div');
    const heading = document.createElement('h2');
    const description = document.createElement('p');
    const closeButton = document.createElement('button');
    const textarea = document.createElement('textarea');
    const message = document.createElement('p');
    const previewWrap = document.createElement('div');
    const previewLabel = document.createElement('span');
    const preview = document.createElement('iframe');
    const footer = document.createElement('footer');
    const cancelButton = document.createElement('button');
    const insert = document.createElement('button');

    htmlInsertState = {
      editor,
      range,
      source,
      existingTextarea: existingTextarea || null,
      existingMarker: existingMarker || '',
      scrollX: window.scrollX,
      scrollY: window.scrollY
    };
    dialog.className = HTML_INSERT_DIALOG_CLASS;
    backdrop.className = 'awaylands-inline-html-backdrop';
    panel.className = 'awaylands-inline-html-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'awaylands-inline-html-title');
    heading.id = 'awaylands-inline-html-title';
    heading.textContent = existingTextarea ? 'Edit HTML Block' : 'Insert HTML';
    description.textContent = existingTextarea ? 'This block stays linked to the inline position shown in Content.' : 'Paste an embed, product list, table, button, or custom HTML.';
    closeButton.type = 'button';
    closeButton.className = 'awaylands-inline-html-close';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.textContent = '×';
    textarea.className = 'awaylands-inline-html-source';
    textarea.setAttribute('aria-label', 'HTML source');
    textarea.spellcheck = false;
    message.className = 'awaylands-inline-html-message';
    message.setAttribute('role', 'status');
    previewWrap.className = 'awaylands-inline-html-preview-wrap';
    previewLabel.textContent = 'Preview - scripts are disabled here for safety';
    preview.className = 'awaylands-inline-html-preview';
    preview.title = 'HTML preview';
    preview.setAttribute('sandbox', 'allow-same-origin');
    cancelButton.type = 'button';
    cancelButton.className = 'awaylands-inline-html-cancel';
    cancelButton.textContent = 'Cancel';
    insert.type = 'button';
    insert.className = 'awaylands-inline-html-insert';
    insert.textContent = existingTextarea ? 'Save HTML' : 'Insert HTML';

    headingGroup.appendChild(heading);
    headingGroup.appendChild(description);
    header.appendChild(headingGroup);
    header.appendChild(closeButton);
    previewWrap.appendChild(previewLabel);
    previewWrap.appendChild(preview);
    footer.appendChild(cancelButton);
    footer.appendChild(insert);
    panel.appendChild(header);
    panel.appendChild(textarea);
    panel.appendChild(message);
    panel.appendChild(previewWrap);
    panel.appendChild(footer);
    dialog.appendChild(backdrop);
    dialog.appendChild(panel);
    document.body.appendChild(dialog);

    const close = () => closeHtmlInsertDialog();

    textarea.value = value || '';
    textarea.addEventListener('input', () => updateHtmlPreview(dialog));
    closeButton.addEventListener('click', close);
    cancelButton.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        close();
      } else if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.target === textarea) {
        event.preventDefault();
        if (!insert.disabled) {
          insert.click();
        }
      }
    });
    insert.addEventListener('click', () => {
      const state = htmlInsertState;
      const html = textarea.value;
      const marker = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

      if (!state || htmlValidationMessage(html)) {
        updateHtmlPreview(dialog);
        return;
      }
      if (state.existingTextarea && state.existingMarker) {
        const returnScrollX = state.scrollX;
        const returnScrollY = state.scrollY;

        setEditorValue(state.existingTextarea, `<div data-awaylands-inline-html="${state.existingMarker}">${html.trim()}</div>`);
        closeHtmlInsertDialog();
        window.requestAnimationFrame(() => window.scrollTo(returnScrollX, returnScrollY));
        return;
      }
      insert.disabled = true;
      insert.textContent = 'Inserting...';
      if (!insertMarkerAtSelection(state.editor, state.range, marker)) {
        insert.disabled = false;
        insert.textContent = 'Insert HTML';
        dialog.querySelector('.awaylands-inline-html-message').textContent = 'Place the cursor in the Content editor, then try again.';
        dialog.querySelector('.awaylands-inline-html-message').classList.add('is-error');
        return;
      }

      createNativeHtmlBlock(html, marker, (success, result) => {
        if (!success) {
          insert.disabled = false;
          insert.textContent = 'Insert HTML';
          dialog.querySelector('.awaylands-inline-html-message').textContent = result;
          dialog.querySelector('.awaylands-inline-html-message').classList.add('is-error');
          return;
        }

        const returnEditor = state.editor;
        const returnScrollX = state.scrollX;
        const returnScrollY = state.scrollY;

        closeHtmlInsertDialog();
        window.requestAnimationFrame(() => {
          window.scrollTo(returnScrollX, returnScrollY);
          returnEditor.focus({ preventScroll: true });
        });
      });
    });

    updateHtmlPreview(dialog);
    textarea.focus();
    panel.scrollTop = 0;
  }

  function inlineHtmlTextareasByMarker() {
    const fields = new Map();

    htmlTextareas().forEach(textarea => {
      const match = (textarea.value || '').match(/data-awaylands-inline-html=["']([a-z0-9-]+)["']/i);

      if (match) {
        fields.set(match[1], textarea);
      }
    });
    return fields;
  }

  function decorateInlineHtmlMarkers() {
    const fields = inlineHtmlTextareasByMarker();

    contentEditors().forEach(editor => {
      editor.querySelectorAll('p, div').forEach(element => {
        const match = normalizedText(element).match(/^\[\[AWAYLANDS_HTML:([a-z0-9-]+)\]\]$/i);
        const textarea = match && fields.get(match[1]);

        if (!textarea || element.querySelector('p, div') || element.hasAttribute('data-awaylands-inline-html-marker')) {
          return;
        }

        const marker = match[1];
        const storageBlock = textarea.closest('[data-testid^="array-field-item-contentBlocks["]');
        const edit = () => openHtmlInsertDialog(editor, storedInlineHtml(textarea, marker), 'existing', textarea, marker);

        element.setAttribute('data-awaylands-inline-html-marker', marker);
        element.setAttribute('role', 'button');
        element.setAttribute('tabindex', '0');
        element.setAttribute('aria-label', 'Edit inline HTML block');
        element.addEventListener('click', edit);
        element.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            edit();
          }
        });
        if (storageBlock) {
          storageBlock.classList.remove('awaylands-new-inline-html-block');
          storageBlock.classList.add('awaylands-inline-html-storage-block');
        }
      });
    });
  }

  function enhanceInlineHtmlInsertion() {
    contentEditors().forEach(editor => {
      const host = contentEditorHost(editor);
      const codeButton = host && host.querySelector('button[title="Code Block"]');
      const toolbar = codeButton && codeButton.parentElement;

      if (!toolbar || toolbar.querySelector(`.${HTML_INSERT_BUTTON_CLASS}`)) {
        return;
      }

      const button = document.createElement('button');

      button.type = 'button';
      button.className = HTML_INSERT_BUTTON_CLASS;
      button.textContent = 'HTML';
      button.title = 'Insert HTML at cursor';
      button.setAttribute('aria-label', 'Insert HTML at cursor');
      button.addEventListener('mousedown', event => {
        const range = currentEditorSelection(editor);

        event.preventDefault();
        htmlInsertState = { editor, range, source: 'button' };
      });
      button.addEventListener('click', event => {
        const savedRange = htmlInsertState && htmlInsertState.editor === editor ? htmlInsertState.range : currentEditorSelection(editor);

        event.preventDefault();
        openHtmlInsertDialog(editor, '', 'button');
        if (htmlInsertState) {
          htmlInsertState.range = savedRange;
        }
      });
      toolbar.appendChild(button);

      editor.addEventListener('paste', event => {
        const plainText = event.clipboardData && event.clipboardData.getData('text/plain');

        if (!looksLikeHtml(plainText)) {
          return;
        }

        event.preventDefault();
        openHtmlInsertDialog(editor, plainText, 'paste');
      });
    });
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

  function directItemChild(item, element) {
    let child = element;

    while (child && child.parentElement !== item) {
      child = child.parentElement;
    }

    return child;
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
    const customFields = Array.from(options.querySelectorAll('label')).filter(label => /custom (title|link)/i.test(normalizedText(label)));
    const sectionFields = Array.from(options.querySelectorAll('label')).filter(label => /^Section [123] - choose article heading$/i.test(normalizedText(label)));
    const customBox = document.createElement('div');

    if (!customFields.length) {
      return;
    }

    toggle.type = 'button';
    toggle.className = 'awaylands-at-a-glance-toggle';
    toggle.textContent = 'Show custom titles and links';
    toggle.setAttribute('aria-expanded', 'false');
    options.classList.add('awaylands-at-a-glance-fields');
    customBox.hidden = true;
    customBox.className = 'awaylands-at-a-glance-options';
    customFields.forEach(label => {
      const field = label.closest('.MuiFormControl-root') || label.parentElement;

      if (field && !field.closest('.awaylands-at-a-glance-options')) {
        customBox.appendChild(field);
      }
    });
    sectionFields.forEach(label => {
      const field = label.closest('.MuiFormControl-root');
      const infoIcons = field && field.querySelectorAll('[data-testid="InfoIcon"]');

      if (field) {
        field.classList.add('awaylands-glance-section-field');
        const row = directItemChild(options, field);

        if (row) {
          row.classList.add('awaylands-glance-section-row');
        }
      }
      if (infoIcons && infoIcons.length) {
        infoIcons[infoIcons.length - 1].closest('.MuiGrid2-root').remove();
      }
    });
    options.appendChild(toggle);
    options.appendChild(customBox);
    toggle.addEventListener('click', () => {
      const open = customBox.hidden;

      customBox.hidden = !open;
      toggle.textContent = open ? 'Hide custom titles and links' : 'Show custom titles and links';
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
      const htmlTextarea = Array.from(item.querySelectorAll('textarea')).find(field => {
        const label = field.closest('.MuiFormControl-root') && field.closest('.MuiFormControl-root').querySelector('label');

        return label && /product embed html/i.test(normalizedText(label));
      });
      const htmlField = htmlTextarea && htmlTextarea.closest('.MuiFormControl-root');
      const htmlChild = htmlField && directItemChild(item, htmlField);

      item.classList.add('awaylands-shop-item', 'is-collapsed');
      if (htmlChild) {
        htmlChild.classList.add('awaylands-shop-html-field');
      }
      toggle.type = 'button';
      toggle.className = 'awaylands-shop-item-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      title.textContent = `Item ${index + 1} custom fields`;
      code.textContent = markup ? 'Image, title and link are available below' : 'Add HTML below or expand custom fields';
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

  function selectMenuValue(original, title) {
    const titles = (Array.isArray(title) ? title : [title]).map(item => item.toLowerCase());

    window.setTimeout(() => {
      original.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        button: 0,
        buttons: 1,
        cancelable: true,
        view: window
      }));
      window.setTimeout(() => {
        const listboxes = Array.from(document.querySelectorAll('[role="listbox"]'));
        const labelledBy = original.getAttribute('aria-labelledby');
        const openList = listboxes.find(list => list.getAttribute('aria-labelledby') === labelledBy) || listboxes[listboxes.length - 1];
        const options = openList ? Array.from(openList.querySelectorAll('.MuiMenuItem-root, [role="option"]')) : [];
        const option = options.find(item => titles.indexOf(normalizedText(item).toLowerCase()) !== -1);

        if (option) {
          option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, cancelable: true, view: window }));
          option.click();
        }
      }, 120);
    }, 0);
  }

  function addChoiceBoxes(labelText, choices) {
    const label = Array.from(document.querySelectorAll('label')).find(item => normalizedText(item).toLowerCase() === labelText.toLowerCase());
    const field = label && label.closest('.MuiFormControl-root');
    const original = field && field.querySelector('[role="button"][aria-haspopup="listbox"]');
    const native = field && field.querySelector('input.MuiSelect-nativeInput');

    if (!field || !original || !native || field.querySelector(`.${CHOICE_GROUP_CLASS}`)) {
      return;
    }

    const group = document.createElement('div');
    const title = document.createElement('div');

    group.className = CHOICE_GROUP_CLASS;
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', normalizedText(label));
    title.className = 'awaylands-choice-title';
    title.textContent = normalizedText(label).replace(/^POST LAYOUT\s*—\s*/i, '');
    choices.forEach(choice => {
      const button = document.createElement('button');

      button.type = 'button';
      button.textContent = choice[0];
      button.setAttribute('data-value', choice[1]);
      button.addEventListener('mousedown', event => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        selectMenuValue(original, choice[0]);
        window.setTimeout(sync, 100);
        window.setTimeout(sync, 300);
      });
      group.appendChild(button);
    });
    label.classList.add('awaylands-choice-original-label');
    original.parentElement.classList.add('awaylands-choice-native-select');
    original.parentElement.insertAdjacentElement('afterend', title);
    title.insertAdjacentElement('afterend', group);

    const sync = () => {
      const value = native.value || 'auto';

      Array.from(group.children).forEach(button => {
        const selected = button.getAttribute('data-value') === value;

        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
    };

    native.addEventListener('change', sync);
    new MutationObserver(sync).observe(native, { attributes: true, attributeFilter: ['value'] });
    window.setInterval(sync, 1200);
    sync();
  }

  function improveLayoutSelectors() {
    addChoiceBoxes('POST LAYOUT — Post Type', [
      ['Auto — recommended', 'auto'],
      ['Standard story', 'standard'],
      ['Quick answer', 'quick-answer'],
      ['Destination guide', 'guide'],
      ['Product review / ranking', 'review'],
      ['Style / shopping edit', 'style-shopping']
    ]);
    addChoiceBoxes('Page Layout', [
      ['Auto — recommended', 'auto'],
      ['Simple / no sidebar', 'simple'],
      ['Sidebar', 'sidebar']
    ]);
  }

  function expandRelationshipMenus() {
    [
      ['category', 'awaylands-category-listbox'],
      ['location', 'awaylands-location-listbox']
    ].forEach(([fieldName, className]) => {
      const input = document.querySelector(`input[role="combobox"][data-testid*="-${fieldName}__input"]`);
      const listboxId = input && input.getAttribute('aria-controls');
      const listbox = listboxId && document.getElementById(listboxId);

      if (listbox) {
        listbox.classList.add(className);
      }
    });
  }

  function fillDefaultAuthorText() {
    const section = document.querySelector(`.${SECTION_BOX_CLASS}[data-section="about-the-author"]`);
    const defaults = {
      'small label': 'About the Author',
      'main title': 'Why trust this guide',
      text: 'Amy Seder is a professional travel photographer with more than a decade of field experience.'
    };

    if (!section || section.hasAttribute('data-author-defaults')) {
      return;
    }

    section.setAttribute('data-author-defaults', 'true');
    Object.keys(defaults).forEach(labelText => {
      const label = Array.from(section.querySelectorAll('label')).find(item => normalizedText(item).toLowerCase() === labelText);
      const input = label && label.closest('.MuiFormControl-root') && label.closest('.MuiFormControl-root').querySelector('input, textarea');

      if (input && !input.value.trim()) {
        if (input.tagName === 'TEXTAREA') {
          setEditorValue(input, defaults[labelText]);
        } else {
          nativeInputValue(input, defaults[labelText]);
        }
      }
    });
  }

  function imageSizeName(figure) {
    const icon = figure.querySelector('svg[class*="image-size-icon-module__"], [class*="image-size-icon-module__"]');
    const classes = icon ? `${icon.getAttribute('class') || ''} ${icon.parentElement ? icon.parentElement.getAttribute('class') || '' : ''}` : '';
    const accessibleName = icon ? `${icon.getAttribute('aria-label') || ''} ${icon.getAttribute('title') || ''}` : '';
    const match = classes.match(/image-size-icon-module__(default|small|medium|large)/i) || accessibleName.match(/\b(default|small|medium|large)\b/i);

    return match ? match[1].toLowerCase() : 'default';
  }

  function decorateImageFigure(figure) {
    const bar = figure.querySelector('[class*="image-properties-bar-module__propertiesBar"]');
    const edit = figure.querySelector('[class*="image-properties-bar-module__edit"]');
    const size = imageSizeName(figure);

    if (!bar || !edit) {
      return;
    }

    let badges = bar.querySelector('.awaylands-image-status-badges');
    let label = badges && badges.querySelector('.awaylands-image-size-label');

    if (!badges) {
      badges = document.createElement('div');
      badges.className = 'awaylands-image-status-badges';
      bar.insertBefore(badges, edit);
    }
    if (!label) {
      label = document.createElement('span');
      label.className = 'awaylands-image-size-label';
      badges.appendChild(label);
    }
    label.textContent = size;
    if (figure.querySelector('a[href]')) {
      setFigureLinkIndicator(figure, true);
    }

    const nativeStatus = figure.querySelector('[class*="image-properties-bar-module__statusIcons"]');

    if (nativeStatus && !nativeStatus.hasAttribute('data-awaylands-size-watch')) {
      nativeStatus.setAttribute('data-awaylands-size-watch', 'true');
      new MutationObserver(() => decorateImageFigure(figure)).observe(nativeStatus, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true
      });
    }
  }

  function setFigureLinkIndicator(figure, linked) {
    const badges = figure && figure.querySelector('.awaylands-image-status-badges');
    let indicator = badges && badges.querySelector('.awaylands-image-link-indicator');

    if (!badges) {
      return;
    }

    if (linked && !indicator) {
      const icon = document.createElement('span');
      const text = document.createElement('strong');

      indicator = document.createElement('span');
      indicator.className = 'awaylands-image-link-indicator';
      indicator.title = 'This image has a link';
      indicator.setAttribute('aria-label', 'Linked image');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '↗';
      text.textContent = 'Linked';
      indicator.appendChild(icon);
      indicator.appendChild(text);
      badges.appendChild(indicator);
    } else if (!linked && indicator) {
      indicator.remove();
    }
  }

  function enhanceImageSizeChoices(dialog) {
    const field = dialog.querySelector('[data-testid="imageBlockForm-size"]');
    const original = field && field.querySelector('[role="button"][aria-haspopup="listbox"]');
    const native = field && field.querySelector('input.MuiSelect-nativeInput, input[type="hidden"], input');

    if (!field || !original || field.querySelector('.awaylands-image-size-choices')) {
      return;
    }

    const group = document.createElement('div');
    const title = document.createElement('div');
    const nativeLabel = field.querySelector('label');
    const choices = [
      ['Default', '', ['None', 'Default']],
      ['Small', 'small', 'Small'],
      ['Medium', 'medium', 'Medium'],
      ['Large', 'large', 'Large']
    ];

    field.classList.add('awaylands-image-size-field');
    title.className = 'awaylands-image-size-title';
    title.textContent = 'Size';
    group.className = 'awaylands-image-size-choices';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Image size');
    choices.forEach(choice => {
      const button = document.createElement('button');

      button.type = 'button';
      button.textContent = choice[0];
      button.setAttribute('data-value', choice[1]);
      button.addEventListener('mousedown', event => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        selectMenuValue(original, choice[2]);
        window.setTimeout(sync, 120);
        window.setTimeout(sync, 350);
      });
      group.appendChild(button);
    });
    if (nativeLabel) {
      nativeLabel.classList.add('awaylands-image-size-native-label');
    }
    original.parentElement.hidden = false;
    original.parentElement.classList.add('awaylands-choice-native-select');
    original.parentElement.insertAdjacentElement('afterend', title);
    title.insertAdjacentElement('afterend', group);

    const sync = () => {
      const displayed = normalizedText(original).toLowerCase();
      const value = native && typeof native.value === 'string' ? native.value.toLowerCase() : '';
      const selectedValue = value || (displayed === 'small' ? 'small' : displayed === 'medium' ? 'medium' : displayed === 'large' ? 'large' : '');

      Array.from(group.children).forEach(button => {
        const selected = button.getAttribute('data-value') === selectedValue;

        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
    };

    if (native) {
      native.addEventListener('input', sync);
      native.addEventListener('change', sync);
      new MutationObserver(sync).observe(native, { attributes: true, attributeFilter: ['value'] });
    }
    new MutationObserver(sync).observe(original, { attributes: true, childList: true, subtree: true });
    const syncTimer = window.setInterval(() => {
      if (!dialog.isConnected) {
        window.clearInterval(syncTimer);
        return;
      }
      sync();
    }, 400);
    sync();
  }

  function runEnhancement(name, callback) {
    try {
      callback();
    } catch (error) {
      console.error(`[Away Lands TakeShape] ${name} failed`, error);
    }
  }

  function enhanceImageEditor() {
    document.querySelectorAll('figure[data-block="true"]').forEach(figure => {
      decorateImageFigure(figure);
      if (figure.hasAttribute('data-awaylands-image-click')) {
        return;
      }
      figure.setAttribute('data-awaylands-image-click', 'true');
      const preview = figure.querySelector('[class*="image-preview-module__preview"]');
      const edit = figure.querySelector('[class*="image-properties-bar-module__edit"] button');

      if (preview && edit) {
        preview.setAttribute('role', 'button');
        preview.setAttribute('tabindex', '0');
        preview.setAttribute('aria-label', 'Edit image');
        const open = () => {
          document.querySelectorAll('figure[data-awaylands-active-image="true"]').forEach(item => item.removeAttribute('data-awaylands-active-image'));
          figure.setAttribute('data-awaylands-active-image', 'true');
          edit.click();
        };
        preview.addEventListener('click', open);
        preview.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open();
          }
        });
      }
      if (edit) {
        edit.addEventListener('click', () => {
          document.querySelectorAll('figure[data-awaylands-active-image="true"]').forEach(item => item.removeAttribute('data-awaylands-active-image'));
          figure.setAttribute('data-awaylands-active-image', 'true');
        }, true);
      }
    });

    const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(item => /Image Caption and Credit/i.test(normalizedText(item)));

    if (!dialog || dialog.classList.contains(IMAGE_DIALOG_CLASS)) {
      return;
    }

    dialog.classList.add(IMAGE_DIALOG_CLASS);
    enhanceImageSizeChoices(dialog);
    const urlLabel = Array.from(dialog.querySelectorAll('label')).find(label => normalizedText(label).toLowerCase() === 'url');
    const urlInput = urlLabel && urlLabel.closest('.MuiFormControl-root') && urlLabel.closest('.MuiFormControl-root').querySelector('input');
    const submit = Array.from(dialog.querySelectorAll('button')).find(button => normalizedText(button) === 'Submit');
    const activeFigure = document.querySelector('figure[data-awaylands-active-image="true"]');
    const syncLink = () => setFigureLinkIndicator(activeFigure, Boolean(urlInput && urlInput.value.trim()));

    syncLink();
    if (urlInput) {
      urlInput.addEventListener('input', syncLink);
      urlInput.setAttribute('autocomplete', 'off');
      urlInput.setAttribute('inputmode', 'url');
      urlInput.setAttribute('type', 'url');
      urlInput.setAttribute('name', 'awaylands-image-link-url');
      urlInput.setAttribute('data-form-type', 'other');
      urlInput.setAttribute('data-lpignore', 'true');
    }
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && event.target.tagName !== 'TEXTAREA' && submit) {
        event.preventDefault();
        syncLink();
        submit.click();
      }
    });
    if (submit) {
      submit.addEventListener('click', () => {
        syncLink();
        if (activeFigure) {
          activeFigure.removeAttribute('data-awaylands-active-image');
        }
      });
    }
  }

  function storyTitles() {
    if (storyTitleIndex) {
      return Promise.resolve(storyTitleIndex);
    }

    if (!storyTitleRequest) {
      storyTitleRequest = new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'awaylands-story-titles' }, response => {
          if (chrome.runtime.lastError || !response || response.error) {
            resolve(null);
            return;
          }

          resolve(response.items || []);
        });
      })
        .then(items => {
          if (!Array.isArray(items)) {
            storyTitleRequest = null;
            return [];
          }

          storyTitleIndex = items
            .filter(item => item && item.title)
            .map(item => Object.assign({}, item, { title: item.title.trim() }))
            .filter(item => item.title);
          return storyTitleIndex;
        })
        .catch(() => {
          storyTitleRequest = null;
          return [];
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

  function localDateTimeValue(date) {
    const localTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));

    return localTime.toISOString().slice(0, 16);
  }

  function addPublishedDateNowButton() {
    const label = Array.from(document.querySelectorAll('label')).find(item => {
      const text = normalizedText(item).toLowerCase();

      return text.indexOf('published') !== -1 && text.indexOf('date') !== -1;
    });
    const field = label && label.closest('.MuiFormControl-root');
    const input = field && field.querySelector('input');

    if (!field || !input || field.querySelector('.awaylands-published-date-now')) {
      return;
    }

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'awaylands-published-date-now';
    button.textContent = 'Update to now';
    button.title = 'Set published date to the current local date and time';
    button.addEventListener('click', () => {
      nativeInputValue(input, localDateTimeValue(new Date()));
      input.focus();
    });
    field.appendChild(button);
  }

  function selectRelatedStory(input, title, results) {
    const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const stopWords = new Set(['about', 'after', 'before', 'best', 'from', 'have', 'into', 'that', 'this', 'with', 'world', 'your']);
    const significantWords = title.split(/\s+/).map(word => word.replace(/[^a-z0-9']/gi, '')).filter(word => word.length >= 4 && !stopWords.has(word.toLowerCase()));
    const queryCandidates = Array.from(new Set([
      significantWords[0],
      significantWords[1],
      significantWords.slice(0, 2).join(' '),
      significantWords.slice(0, 3).join(' '),
      title
    ].concat(significantWords).filter(Boolean)));
    let queryIndex = 0;

    const applyQuery = value => {
      nativeInputValue(input, value);
      if (typeof InputEvent === 'function') {
        input.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
      }
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    };

    relatedSelectionInputs.add(input);
    results.hidden = true;
    input.click();
    applyQuery(queryCandidates[queryIndex]);
    let attempts = 0;
    const timer = window.setInterval(() => {
      const controlledList = input.getAttribute('aria-controls') && document.getElementById(input.getAttribute('aria-controls'));
      const options = controlledList ? Array.from(controlledList.querySelectorAll('[role="option"], .MuiAutocomplete-option')) : Array.from(document.querySelectorAll('[role="option"], .MuiAutocomplete-option'));
      const option = options.find(item => {
        const optionTitle = normalizedText(item).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

        return optionTitle === normalizedTitle || optionTitle.indexOf(normalizedTitle) !== -1;
      });

      attempts += 1;
      if (option) {
        window.clearInterval(timer);
        if (typeof PointerEvent === 'function') {
          option.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, cancelable: true }));
        }
        option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, cancelable: true, view: window }));
        option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0, cancelable: true, view: window }));
        option.click();
        relatedSelectionInputs.delete(input);
        results.hidden = true;
      } else if (attempts % 12 === 0 && queryIndex < queryCandidates.length - 1) {
        queryIndex += 1;
        applyQuery(queryCandidates[queryIndex]);
      } else if (attempts >= Math.max(60, queryCandidates.length * 12)) {
        window.clearInterval(timer);
        relatedSelectionInputs.delete(input);
        input.focus();
        input.setAttribute('title', 'Choose the matching story from TakeShape’s native options to create a saved relationship.');
        results.hidden = true;
      }
    }, 100);
  }

  function renderRelatedResults(input, results, items) {
    const query = input.value.trim().toLowerCase();
    const words = query.split(/\s+/).filter(Boolean);
    const sortedItems = items.slice().sort((first, second) => {
      const firstTime = Date.parse(first.updatedAt || '') || 0;
      const secondTime = Date.parse(second.updatedAt || '') || 0;

      return secondTime - firstTime;
    });

    clearElement(results);
    const matches = (query ? items.filter(item => {
      const title = item.title.toLowerCase();

      return words.every(word => title.indexOf(word) !== -1);
    }) : sortedItems).slice(0, query ? 60 : 15);

    if (!matches.length) {
      showElementMessage(results, query ? 'No matching stories found.' : 'Unable to load recent stories. Click the field to try again.');
      results.hidden = false;
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
    document.querySelectorAll(`.${RELATED_RESULTS_CLASS}`).forEach(results => results.remove());
    document.querySelectorAll('.awaylands-related-search-host').forEach(host => host.classList.remove('awaylands-related-search-host'));

    const label = Array.from(document.querySelectorAll('label')).find(item => normalizedText(item) === 'Related Stories');
    const field = label && label.closest('.MuiFormControl-root');
    const input = field && field.querySelector('input[role="combobox"]');

    if (!field || !input) {
      return;
    }
    input.setAttribute('data-awaylands-native-related-search', 'true');
    input.setAttribute('title', 'Search and select a story from TakeShape’s relationship results.');

    const inputRect = input.getBoundingClientRect();
    const controlledId = input.getAttribute('aria-controls');
    const listboxes = Array.from(document.querySelectorAll('[role="listbox"], .MuiAutocomplete-listbox')).filter(listbox => {
      const rect = listbox.getBoundingClientRect();
      const overlapsInput = rect.right >= inputRect.left && rect.left <= inputRect.right;
      const nearInput = Math.abs(rect.top - inputRect.bottom) < 900 || Math.abs(rect.bottom - inputRect.top) < 900;

      return rect.width > 0 && rect.height > 0 && overlapsInput && nearInput;
    });

    if (listboxes.length) {
      const scoreListbox = listbox => {
        const options = Array.from(listbox.querySelectorAll('[role="option"], .MuiAutocomplete-option'));
        const enabledOptions = options.filter(option => option.getAttribute('aria-disabled') !== 'true');
        let score = 0;

        if (controlledId && listbox.id === controlledId) score += 100;
        if (enabledOptions.length) score += 25;
        if (window.getComputedStyle(listbox).pointerEvents !== 'none') score += 10;
        score += Math.min(enabledOptions.length, 20);
        return score;
      };
      const primaryListbox = listboxes.slice().sort((first, second) => scoreListbox(second) - scoreListbox(first))[0];

      listboxes.forEach(listbox => {
        listbox.classList.toggle('awaylands-primary-related-listbox', listbox === primaryListbox);
        listbox.classList.toggle('awaylands-duplicate-related-listbox', listbox !== primaryListbox);
      });
    }
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
    const match = (field.value || '').match(/<iframe\b[^>]*\bsrc\s*=\s*(["'])(https:\/\/rvlv\.me\/[^"']+)\1/i);
    const sourceUrl = match && match[2] ? match[2].replace(/&amp;/g, '&') : '';

    if (!sourceUrl) {
      button.textContent = 'Paste a Revolve iframe first';
      return;
    }

    const preview = document.createElement('iframe');

    preview.src = sourceUrl;
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
    runEnhancement('section layout', groupMajorSections);

    document.querySelectorAll('h4').forEach(heading => {
      const text = normalizedText(heading);

      heading.classList.add(SECTION_CLASS);
      heading.classList.toggle(CONTENT_CLASS, text === 'Content' || text.indexOf('Content Block') === 0 || text === 'Image' || text === 'Social');
      heading.classList.toggle('awaylands-social-section-title', text === 'Social');
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

    runEnhancement('content block buttons', addContentBlockButtons);
    runEnhancement('inline HTML', enhanceInlineHtmlInsertion);
    runEnhancement('inline HTML markers', decorateInlineHtmlMarkers);
    runEnhancement('unused controls', removeUnusedControls);
    runEnhancement('At a Glance', collapseAtAGlanceOptions);
    runEnhancement('Shop the Edit', collapseShopItems);
    runEnhancement('related stories', improveRelatedStorySearch);
    runEnhancement('layout selectors', improveLayoutSelectors);
    runEnhancement('relationship menus', expandRelationshipMenus);
    runEnhancement('published date', addPublishedDateNowButton);
    runEnhancement('author defaults', fillDefaultAuthorText);
    runEnhancement('image editor', enhanceImageEditor);
    runEnhancement('gallery close', keepGallerySidebarUsable);
    runEnhancement('persistent gallery', tryOpenPersistentGallery);
    runEnhancement('native publishing status', restoreNativePublishingStatus);
    runEnhancement('save and continue', makeStorySaveContinue);
    runEnhancement('story tools below gallery', moveStoryToolsBelowGallery);
    runEnhancement('bottom editor bar', removeBottomEditorBar);
    runEnhancement('story publishing default', enableStoryOnOpen);
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
