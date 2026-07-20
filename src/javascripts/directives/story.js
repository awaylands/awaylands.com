import {LuminousGallery} from '../luminous';

const ImagesLoaded = require('imagesloaded');

const opts = {
  sourceAttribute: 'data-full-src'
};

const galleryOpts = {
  arrowNavigation: true
};

const TEXT_NODE = 3;
const TAKE_SHAPE_IMAGE_HOST = 'images.takeshape.io';
const AFFILIATE_URL_PATTERN = /(rvlv\.me|amzn\.to|amazon\.|on\.ltk\.com|ltk\.app\.link|liketk\.it|rstyle\.me|rewardstyle\.com|shopstyle\.)/i;
const COMMERCE_EMBED_PATTERN = /(rvlv\.me|on\.ltk\.com|rewardstyle|shopstyle)/i;
const SHOP_EMBED_HOST_PATTERN = /(^|\.)(ltk\.app|ltkcdn\.com|shopltk\.com|rewardstyle\.com|rstyle\.me|shopstyle\.com|revolve\.com|rvlv\.me)$/i;
const ADVANCED_STORY_PREVIEW_PATTERN = /^\/post[2-4]\/?$/;
const DECORATIVE_IMAGE_PATTERN = /(rewardstyle.*\/search\/350\.gif|tracking|pixel)/i;
const INLINE_HTML_MARKER_PATTERN = /^\[\[AWAYLANDS_HTML:([a-z0-9-]+)\]\]$/i;

function isAdvancedStoryPreview() {
  return ADVANCED_STORY_PREVIEW_PATTERN.test(window.location.pathname);
}

function placeInlineHtmlBlocks(el) {
  const blocks = el.querySelectorAll('[data-awaylands-inline-html]');

  Array.prototype.forEach.call(blocks, block => {
    const markerId = block.getAttribute('data-awaylands-inline-html');
    const markerText = `[[AWAYLANDS_HTML:${markerId}]]`;
    const paragraphs = el.querySelectorAll('p');
    let marker = null;

    Array.prototype.some.call(paragraphs, candidate => {
      if (candidate === block || block.contains(candidate) || candidate.closest('[data-awaylands-inline-html]')) {
        return false;
      }
      if ((candidate.textContent || '').trim() === markerText && INLINE_HTML_MARKER_PATTERN.test((candidate.textContent || '').trim())) {
        marker = candidate;
        return true;
      }

      return false;
    });

    if (!marker || !marker.parentNode) {
      return;
    }

    marker.parentNode.insertBefore(block, marker);
    marker.parentNode.removeChild(marker);
  });
}

function storyImageWidth(image) {
  const figure = image.closest('figure');

  if (!figure) {
    return 1200;
  }

  if (figure.classList.contains('small')) {
    return 600;
  }

  if (figure.classList.contains('medium')) {
    return 900;
  }

  if (figure.classList.contains('large') || figure.classList.contains('wide')) {
    return 1600;
  }

  if (figure.classList.contains('full') || figure.classList.contains('full-width')) {
    return 2000;
  }

  return 1200;
}

function hasManualFigureSize(figure) {
  return ['tiny', 'compact', 'small', 'medium', 'default', 'text', 'large', 'wide', 'full', 'full-width'].some(size => (
    figure.classList.contains(size)
  ));
}

function applyAutomaticFigureSize(figure, image) {
  if (
    !figure ||
    !image.naturalWidth ||
    !image.naturalHeight ||
    figure.closest('.story-gallery') ||
    figure.classList.contains('story-product-figure') ||
    (hasManualFigureSize(figure) && !figure.classList.contains('auto'))
  ) {
    return;
  }

  figure.classList.remove('auto', 'story-auto-size--portrait', 'story-auto-size--landscape', 'story-auto-size--text');
  figure.classList.add('default');
}

function optimizedTakeShapeImageUrl(src, width) {
  try {
    const url = new URL(src);

    if (url.hostname !== TAKE_SHAPE_IMAGE_HOST || url.searchParams.has('w')) {
      return src;
    }

    url.searchParams.set('auto', 'compress,format');
    url.searchParams.set('w', width);

    return url.toString();
  } catch (error) {
    return src;
  }
}

function safelyDecodeImageName(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function cleanAutomaticImageAlt(value) {
  let alt = safelyDecodeImageName(value || '')
    .replace(/^.*\//, '')
    .replace(/\.[a-z0-9]{2,5}(?:\?.*)?$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\baway\s+lands\b/ig, '')
    .replace(/\b(?:img|dsc|image)\s*\d*\b/ig, '')
    .replace(/\bshop(?:\s+this|\s+the)?\b/ig, '')
    .replace(/\s+for\s+\$[\d,.]+/ig, '')
    .replace(/\bhere\b/ig, '')
    .replace(/\s+\d{1,4}$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:|-]+|[\s,.;:|-]+$/g, '')
    .trim();

  if (alt.length > 140) {
    alt = alt.slice(0, 140).replace(/\s+\S*$/, '').trim();
  }

  return alt;
}

function automaticImageAlt(image) {
  const figure = image.closest('figure');
  const caption = figure && figure.querySelector('figcaption');
  const captionAlt = cleanAutomaticImageAlt(caption && caption.textContent);
  const source = image.getAttribute('data-full-src') || image.getAttribute('src') || '';
  const filenameAlt = cleanAutomaticImageAlt(source);

  if (captionAlt && !/^(photo|image|affiliate links?)$/i.test(captionAlt)) {
    return captionAlt;
  }

  return filenameAlt;
}

function setStoryImageDimensions(image) {
  if (!image.naturalWidth || !image.naturalHeight || DECORATIVE_IMAGE_PATTERN.test(image.currentSrc || image.src || '')) {
    return;
  }

  if (!image.hasAttribute('width')) {
    image.setAttribute('width', image.naturalWidth);
  }

  if (!image.hasAttribute('height')) {
    image.setAttribute('height', image.naturalHeight);
  }

  applyAutomaticFigureSize(image.closest('figure'), image);
}

function prepareStoryImage(image, index, hasStoryHero) {
  const originalSrc = image.getAttribute('src');

  if (originalSrc && !image.hasAttribute('data-full-src')) {
    image.setAttribute('data-full-src', originalSrc);
  }

  if (originalSrc) {
    const optimizedSrc = optimizedTakeShapeImageUrl(originalSrc, storyImageWidth(image));

    if (optimizedSrc !== originalSrc) {
      image.setAttribute('src', optimizedSrc);
    }
  }

  if (!image.hasAttribute('alt')) {
    if (DECORATIVE_IMAGE_PATTERN.test(originalSrc || '')) {
      image.setAttribute('alt', '');
    } else {
      image.setAttribute('alt', automaticImageAlt(image));
      image.setAttribute('data-auto-alt', 'true');
    }
  }

  if (!image.hasAttribute('decoding')) {
    image.setAttribute('decoding', 'async');
  }

  if (!image.hasAttribute('loading')) {
    image.setAttribute('loading', !hasStoryHero && index === 0 ? 'eager' : 'lazy');
  }

  if (image.complete) {
    setStoryImageDimensions(image);
  } else if (!image.hasAttribute('data-dimension-listener')) {
    image.setAttribute('data-dimension-listener', 'true');
    image.addEventListener('load', () => setStoryImageDimensions(image), {once: true});
  }
}

function edgeTextNode(element, fromEnd) {
  const children = element.childNodes;
  const start = fromEnd ? children.length - 1 : 0;
  const finish = fromEnd ? -1 : children.length;
  const step = fromEnd ? -1 : 1;

  for (let index = start; index !== finish; index += step) {
    const child = children[index];

    if (child.nodeType === TEXT_NODE) {
      return child;
    }

    if (child.childNodes && child.childNodes.length) {
      const nested = edgeTextNode(child, fromEnd);

      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function ensureSpaceBesideLink(link, before) {
  const sibling = before ? link.previousSibling : link.nextSibling;

  if (sibling && sibling.nodeType === TEXT_NODE) {
    if (before && !/\s$/.test(sibling.nodeValue || '')) {
      sibling.nodeValue += ' ';
    } else if (!before && !/^\s/.test(sibling.nodeValue || '')) {
      sibling.nodeValue = ` ${sibling.nodeValue || ''}`;
    }

    return;
  }

  link.parentNode.insertBefore(document.createTextNode(' '), before ? link : link.nextSibling);
}

function restoreCollapsedInlineGap(link, before) {
  let sibling = before ? link.previousSibling : link.nextSibling;
  let crossedEmptyInlineElement = false;

  while (
    sibling &&
    sibling.nodeType === 1 &&
    /^(B|EM|I|SPAN|STRONG)$/.test(sibling.tagName) &&
    !(sibling.textContent || '')
  ) {
    crossedEmptyInlineElement = true;
    sibling = before ? sibling.previousSibling : sibling.nextSibling;
  }

  if (!crossedEmptyInlineElement || !sibling || sibling.nodeType !== TEXT_NODE) {
    return;
  }

  const linkText = (link.textContent || '').trim();
  const siblingText = sibling.nodeValue || '';
  const needsSpace = before ? (
    /[A-Za-z0-9]$/.test(siblingText) && /^[A-Za-z0-9]/.test(linkText)
  ) : (
    /[A-Za-z0-9]$/.test(linkText) && /^[A-Za-z0-9]/.test(siblingText)
  );

  if (needsSpace) {
    ensureSpaceBesideLink(link, before);
  }
}

function normalizeInlineLinkSpaces(el) {
  const links = el.querySelectorAll('a');

  Array.prototype.forEach.call(links, link => {
    const firstNode = edgeTextNode(link, false);
    const lastNode = edgeTextNode(link, true);
    const hasLeadingSpace = firstNode && /^\s+/.test(firstNode.nodeValue || '');
    const hasTrailingSpace = lastNode && /\s+$/.test(lastNode.nodeValue || '');

    if (hasLeadingSpace) {
      firstNode.nodeValue = firstNode.nodeValue.replace(/^\s+/, '');
      ensureSpaceBesideLink(link, true);
    }

    if (hasTrailingSpace) {
      lastNode.nodeValue = lastNode.nodeValue.replace(/\s+$/, '');
      ensureSpaceBesideLink(link, false);
    }

    restoreCollapsedInlineGap(link, true);
    restoreCollapsedInlineGap(link, false);
  });
}

function normalizeStoryLinks(el) {
  const links = el.querySelectorAll('a[href]');

  Array.prototype.forEach.call(links, link => {
    const href = (link.getAttribute('href') || '').trim();

    if (!href) {
      return;
    }

    link.setAttribute('href', href);

    const isExternal = /^https?:\/\//i.test(href) && link.hostname !== window.location.hostname;

    if ((isExternal || link.querySelector('img')) && !link.hasAttribute('target')) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener');
    }
  });
}

function linkImagesFromLinkedCaptions(el) {
  const figures = el.querySelectorAll('figure');

  Array.prototype.forEach.call(figures, figure => {
    const image = figure.querySelector('img');
    const caption = figure.querySelector('figcaption');
    const links = caption ? caption.querySelectorAll('a[href]') : [];

    if (!image || !caption || links.length !== 1 || image.closest('a[href]')) {
      return;
    }

    const sourceLink = links[0];
    const captionText = (caption.textContent || '').replace(/\s+/g, ' ').trim();
    const linkText = (sourceLink.textContent || '').replace(/\s+/g, ' ').trim();
    const href = (sourceLink.getAttribute('href') || '').trim();

    if (!href || !captionText || captionText !== linkText) {
      return;
    }

    const imageLink = document.createElement('a');
    const parent = image.parentNode;

    imageLink.href = href;
    imageLink.target = '_blank';
    imageLink.rel = 'sponsored nofollow noopener';
    imageLink.className = 'story-image-link story-affiliate-link';
    parent.insertBefore(imageLink, image);
    imageLink.appendChild(image);
    figure.classList.add('story-product-figure', 'story-product-figure--caption-link');
  });
}

function optimizeStoryImages(el) {
  const images = el.querySelectorAll('img');
  const hasStoryHero = Boolean(document.querySelector('[data-story-hero]'));

  Array.prototype.forEach.call(images, (image, index) => {
    prepareStoryImage(image, index, hasStoryHero);
  });
}

function replaceHeading(heading, tagName) {
  const replacement = document.createElement(tagName);

  Array.prototype.forEach.call(heading.attributes, attribute => {
    replacement.setAttribute(attribute.name, attribute.value);
  });

  while (heading.firstChild) {
    replacement.appendChild(heading.firstChild);
  }

  heading.parentNode.replaceChild(replacement, heading);
  return replacement;
}

function normalizeStoryHeadings(el) {
  const nestedPrimaryHeadings = el.querySelectorAll('h1');

  Array.prototype.forEach.call(nestedPrimaryHeadings, heading => {
    replaceHeading(heading, 'h2');
  });

  const children = Array.prototype.slice.call(el.children);

  children.forEach(child => {
    const text = (child.textContent || '').replace(/\u00a0/g, ' ').trim();

    if (/^H[1-6]$/.test(child.tagName) && !text) {
      child.parentNode.removeChild(child);
      return;
    }

    if (
      child.tagName !== 'P' ||
      text.length < 8 ||
      text.length > 120 ||
      !/:$/.test(text) ||
      child.querySelector('a, img, iframe, video, audio, object, embed')
    ) {
      return;
    }

    const emphasis = child.querySelector('strong, b');
    const emphasizedText = emphasis && (emphasis.textContent || '')
      .replace(/\u00a0/g, ' ')
      .trim();

    if (emphasizedText !== text) {
      return;
    }

    const heading = replaceHeading(child, 'h2');

    heading.classList.add('story-heading--auto');
  });
}

function slugifyHeading(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function storyTocTitle(value) {
  return (value || '')
    .replace(/^\s*(?:#\s*)?\d{1,3}\s*[.)\-–—:]\s*/, '')
    .trim();
}

function storySectionHeadings(el) {
  const levels = ['h2', 'h3', 'h4'];

  for (let index = 0; index < levels.length; index += 1) {
    const headings = Array.prototype.filter.call(el.querySelectorAll(levels[index]), heading => (
      !heading.closest('.story-commerce-embed, .story-ltk-embed, aside, blockquote') &&
      Boolean(storyTocTitle(heading.textContent))
    ));

    if (headings.length >= 3) {
      return headings;
    }
  }

  return [];
}

function prepareLongStoryToc(toc, list) {
  const itemCount = list.children.length;

  if (itemCount <= 10) {
    return;
  }

  toc.classList.add('story-toc--long');

  if (toc.querySelector('.story-toc__more')) {
    return;
  }

  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'story-toc__more';
  button.setAttribute('aria-expanded', 'false');

  const updateButton = () => {
    const isExpanded = toc.classList.contains('is-expanded');

    button.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    button.textContent = isExpanded ? 'Show fewer sections' : `Show all ${itemCount} sections`;
  };

  button.addEventListener('click', () => {
    toc.classList.toggle('is-expanded');
    updateButton();
  });

  updateButton();
  list.parentNode.appendChild(button);
}

function buildStoryContents(el) {
  const storyPage = el.closest('[data-story-page]');

  if (!storyPage || !shouldUseAdvancedStory(el, storyPage)) {
    return;
  }

  const toc = storyPage.querySelector('[data-story-toc]');
  const list = storyPage.querySelector('[data-story-toc-list]');
  const headings = storySectionHeadings(el);

  if (!toc || !list || headings.length < 3) {
    return;
  }

  if (!list.children.length) {
    const usedIds = {};

    Array.prototype.forEach.call(headings, (heading, index) => {
      const text = (heading.textContent || '').trim();
      const tocTitle = storyTocTitle(text);

      if (!tocTitle) {
        return;
      }

      const baseId = heading.id || slugifyHeading(text) || `section-${index + 1}`;
      let id = baseId;
      let duplicate = 2;

      while (usedIds[id]) {
        id = `${baseId}-${duplicate}`;
        duplicate += 1;
      }

      usedIds[id] = true;
      heading.id = id;

      const item = document.createElement('li');
      const link = document.createElement('a');

      link.href = `#${id}`;
      link.textContent = tocTitle;
      item.appendChild(link);
      list.appendChild(item);
    });
  }

  prepareLongStoryToc(toc, list);
  toc.hidden = false;
}

function promoteQuickAnswer(el) {
  const storyPage = el.closest('[data-story-page]');

  if (!storyPage || storyPage.getAttribute('data-story-type') !== 'quick-answer') {
    return;
  }

  const answer = storyPage.querySelector('[data-quick-answer]');
  const answerText = storyPage.querySelector('[data-quick-answer-text]');

  if (!answer || !answerText || answerText.textContent) {
    return;
  }

  const paragraphs = el.querySelectorAll('p');
  let source = null;

  for (let index = 0; index < paragraphs.length; index += 1) {
    const text = (paragraphs[index].textContent || '').trim();

    if (text.length > 80) {
      source = paragraphs[index];
      break;
    }
  }

  if (!source) {
    return;
  }

  answerText.textContent = source.textContent.trim();
  source.classList.add('is-promoted-summary');
  answer.hidden = false;
}

function enhanceAffiliateLinks(el) {
  const links = el.querySelectorAll('a[href]');
  const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent || '');

  Array.prototype.forEach.call(links, link => {
    const href = link.getAttribute('href') || '';
    const isAmazonLink = /(^|\/\/)([^/]+\.)?(amazon\.[a-z.]+|amzn\.to)(\/|$)/i.test(href);
    const isLtkLink = /(^|\/\/)([^/]+\.)?(ltk\.app|shopltk\.com|liketk\.it|on\.ltk\.com|rstyle\.me|rewardstyle\.com)(\/|$)/i.test(href);
    const isBestBuyLink = /(^|\/\/)([^/]+\.)?(bestbuy\.com|bestbuy\.7tiv\.net|bby\.me)(\/|$)/i.test(href);

    if (!AFFILIATE_URL_PATTERN.test(href) && !isBestBuyLink && !link.closest('.shopthepost-widget, [data-affiliate-link]')) {
      return;
    }

    link.classList.add('story-affiliate-link');
    const rel = (link.getAttribute('rel') || '').split(/\s+/).filter(Boolean);

    ['sponsored', 'nofollow', 'noopener'].forEach(value => {
      if (rel.indexOf(value) === -1) {
        rel.push(value);
      }
    });

    link.setAttribute('rel', rel.join(' '));
    link.setAttribute('target', '_blank');

    if (isMobileDevice && isAmazonLink) {
      link.setAttribute('target', '_self');
      link.setAttribute('data-mobile-app-link', 'amazon');
    }

    if (isMobileDevice && (isLtkLink || isBestBuyLink)) {
      link.setAttribute('target', '_blank');
      link.setAttribute('data-mobile-browser-link', isLtkLink ? 'ltk' : 'best-buy');
      if (!link._storyMobileBrowser) {
        link._storyMobileBrowser = true;
        link.addEventListener('click', event => {
          event.preventDefault();
          const opened = window.open(link.href, '_blank');

          if (opened) {
            opened.opener = null;
          } else {
            window.location.assign(link.href);
          }
        });
      }
    }

    const figure = link.closest('figure');

    if (figure) {
      figure.classList.add('story-product-figure');
    }
  });
}

function removeEmptyLtkSpacing(widget) {
  let sibling = widget.nextElementSibling;
  let removed = 0;

  while (sibling && removed < 6 && sibling.tagName === 'P' && !(sibling.textContent || '').trim()) {
    const next = sibling.nextElementSibling;

    sibling.parentNode.removeChild(sibling);
    sibling = next;
    removed += 1;
  }
}

function enhanceLtkWidgets(el) {
  const widgets = el.querySelectorAll('.shopthepost-widget');

  Array.prototype.forEach.call(widgets, widget => {
    if (widget.closest('.story-ltk-embed')) {
      return;
    }

    const wrapper = document.createElement('section');

    wrapper.className = 'story-ltk-embed';
    wrapper.setAttribute('aria-label', 'Shop this edit');
    widget.parentNode.insertBefore(wrapper, widget);
    wrapper.appendChild(widget);
    removeEmptyLtkSpacing(wrapper);
  });
}

function addCommissionDisclosure(el) {
  const storyPage = el.closest('[data-story-page]');
  const article = storyPage && storyPage.querySelector('.story-article');
  const footer = article && article.querySelector('.story-article__footer');
  const hasAffiliateContent = Boolean(
    el.querySelector('.story-affiliate-link, .story-commerce-embed, .story-ltk-embed')
  );

  if (!article || !footer || !hasAffiliateContent || article.querySelector('.story-commission-note')) {
    return;
  }

  const disclosure = document.createElement('p');

  disclosure.className = 'story-commission-note';
  disclosure.textContent = 'Away Lands may earn a commission from links in this story.';
  article.insertBefore(disclosure, footer);
}

function observeStoryEnhancements(el) {
  if (el.hasAttribute('data-story-observed') || typeof MutationObserver === 'undefined') {
    return;
  }

  el.setAttribute('data-story-observed', 'true');

  const observer = new MutationObserver(mutations => {
    let shouldRefreshDisclosure = false;

    mutations.forEach(mutation => {
      Array.prototype.forEach.call(mutation.addedNodes, node => {
        if (node.nodeType !== 1) {
          return;
        }

        if (node.matches && node.matches('a[href]')) {
          enhanceAffiliateLinks(node.parentNode || el);
          shouldRefreshDisclosure = true;
        } else if (node.querySelector && node.querySelector('a[href]')) {
          enhanceAffiliateLinks(node);
          shouldRefreshDisclosure = true;
        }

        if (node.matches && node.matches('img')) {
          prepareStoryImage(node, 1, true);
        } else if (node.querySelectorAll) {
          Array.prototype.forEach.call(node.querySelectorAll('img'), image => {
            prepareStoryImage(image, 1, true);
          });
        }

        if ((node.matches && node.matches('.shopthepost-widget')) || (node.querySelector && node.querySelector('.shopthepost-widget'))) {
          enhanceLtkWidgets(el);
          shouldRefreshDisclosure = true;
        }
      });
    });

    if (shouldRefreshDisclosure) {
      addCommissionDisclosure(el);
    }
  });

  observer.observe(el, {childList: true, subtree: true});
}

function enhancePhotoCaptions(el) {
  const figures = el.querySelectorAll('figure');

  Array.prototype.forEach.call(figures, figure => {
    const caption = figure.querySelector('figcaption');

    if (
      !figure.querySelector('img') ||
      !caption ||
      !(caption.textContent || '').trim()
    ) {
      return;
    }

    figure.classList.add('story-figure--caption-overlay');
  });
}

function enhanceCommerceEmbeds(el) {
  const frames = el.querySelectorAll('iframe[src]');

  Array.prototype.forEach.call(frames, frame => {
    const src = frame.getAttribute('src') || '';

    frame.setAttribute('loading', 'lazy');

    if (!COMMERCE_EMBED_PATTERN.test(src) || frame.closest('.story-commerce-embed')) {
      return;
    }

    const wrapper = document.createElement('section');
    const header = document.createElement('div');
    const title = document.createElement('span');
    const disclosure = document.createElement('span');
    const parent = frame.parentNode;

    wrapper.className = 'story-commerce-embed';
    header.className = 'story-commerce-embed__header';
    title.textContent = 'Shop the edit';
    disclosure.textContent = 'Affiliate links';
    header.appendChild(title);
    header.appendChild(disclosure);

    if (parent.tagName === 'P' && !(parent.textContent || '').trim()) {
      parent.parentNode.insertBefore(wrapper, parent);
      wrapper.appendChild(header);
      wrapper.appendChild(frame);
      parent.parentNode.removeChild(parent);
    } else {
      parent.insertBefore(wrapper, frame);
      wrapper.appendChild(header);
      wrapper.appendChild(frame);
    }

    if (!frame.getAttribute('title')) {
      frame.setAttribute('title', 'Shop this edit');
    }
  });
}

function wrapAutomaticFigureGroup(el, figures, layout) {
  const gallery = document.createElement('div');

  gallery.className = `story-gallery story-gallery--${layout}`;
  gallery.setAttribute('data-count', figures.length);
  gallery.setAttribute('data-auto-layout', layout);
  el.insertBefore(gallery, figures[0]);
  figures.forEach(figure => gallery.appendChild(figure));
}

function groupStoryFigures(el) {
  const children = Array.prototype.slice.call(el.children);
  let index = 0;

  while (index < children.length) {
    const child = children[index];

    if (child.tagName !== 'FIGURE' || child.parentNode !== el) {
      index += 1;
      continue;
    }

    let sizeClass = null;

    if (child.classList.contains('medium')) {
      sizeClass = 'medium';
    } else if (child.classList.contains('small')) {
      sizeClass = 'small';
    }

    if (sizeClass) {
      const figures = [];
      let nextIndex = index;

      while (nextIndex < children.length) {
        const candidate = children[nextIndex];

        if (
          candidate.tagName !== 'FIGURE' ||
          candidate.parentNode !== el ||
          !candidate.classList.contains(sizeClass)
        ) {
          break;
        }

        figures.push(candidate);
        nextIndex += 1;
      }

      const layout = sizeClass === 'medium' ? 'medium-pair' : 'small-grid';

      if (figures.length > 1) {
        wrapAutomaticFigureGroup(el, figures, layout);
      }

      index = nextIndex;
      continue;
    }

    index += 1;
  }
}

function isEmptyStoryParagraph(node) {
  return (
    node.tagName === 'P' &&
    !(node.textContent || '').replace(/\u00a0/g, ' ').trim() &&
    !node.querySelector('img, iframe, video, audio, object, embed')
  );
}

function normalizeStorySpacing(el) {
  const children = Array.prototype.slice.call(el.children);
  let previousWasLineBreak = false;

  children.forEach(child => {
    if (!isEmptyStoryParagraph(child)) {
      previousWasLineBreak = false;
      return;
    }

    const next = child.nextElementSibling;
    const nextIsImage = next && (
      next.tagName === 'FIGURE' ||
      next.classList.contains('story-gallery')
    );

    if (nextIsImage) {
      child.parentNode.removeChild(child);
      return;
    }

    if (previousWasLineBreak) {
      child.parentNode.removeChild(child);
      return;
    }

    child.classList.add('story-line-break');
    child.setAttribute('aria-hidden', 'true');
    previousWasLineBreak = true;
  });

  Array.prototype.slice.call(el.children).forEach(child => {
    const next = child.nextElementSibling;
    const childIsImage = child.tagName === 'FIGURE' || child.classList.contains('story-gallery');
    const nextIsImage = next && (next.tagName === 'FIGURE' || next.classList.contains('story-gallery'));
    const nextRemovesSpacing = nextIsImage && next.classList.contains('spacing-none');

    child.classList.toggle('story-image-followed-by-image', !!(childIsImage && nextIsImage && !nextRemovesSpacing));
    child.classList.toggle('story-content-followed-by-image', !!(!childIsImage && nextIsImage && !nextRemovesSpacing));
    child.classList.toggle('story-content-followed-by-no-spacing-image', !!(!childIsImage && nextIsImage && nextRemovesSpacing));
  });
}

function normalizedImagePath(src) {
  try {
    return new URL(src, window.location.href).pathname.replace(/\/$/, '');
  } catch (error) {
    return src.split('?')[0];
  }
}

function removeDuplicateHero(el) {
  const hero = document.querySelector('[data-story-hero]');

  if (!hero) {
    return;
  }

  const heroPath = normalizedImagePath(hero.currentSrc || hero.src || '');
  const images = el.querySelectorAll('figure img');
  const firstArticleFigure = el.querySelector('figure');

  Array.prototype.forEach.call(images, image => {
    const original = image.getAttribute('data-full-src') || image.currentSrc || image.src || '';

    if (heroPath && normalizedImagePath(original) === heroPath) {
      const figure = image.closest('figure');

      if (figure) {
        if (figure !== firstArticleFigure) {
          figure.classList.remove('story-duplicate-hero');
          return;
        }

        const previous = figure.previousElementSibling;
        const next = figure.nextElementSibling;
        let preceding = previous;
        let hasMeaningfulContentBefore = false;

        while (preceding) {
          if ((preceding.textContent || '').trim() || preceding.querySelector('img, iframe, video, table')) {
            hasMeaningfulContentBefore = true;
            break;
          }
          preceding = preceding.previousElementSibling;
        }
        const belongsToLegacyImageSequence = (
          (previous && previous.tagName === 'FIGURE') ||
          (next && next.tagName === 'FIGURE')
        );

        if (!hasMeaningfulContentBefore && !belongsToLegacyImageSequence) {
          figure.classList.add('story-duplicate-hero');
        } else {
          figure.classList.remove('story-duplicate-hero');
        }
      }
    }
  });
}

function addPreviewAdPlaceholders(el) {
  if (!/^\/post[1-4]\/?$/.test(window.location.pathname) || el.querySelector('.story-ad-placeholder')) {
    return;
  }

  const headings = el.querySelectorAll('h2');
  const positions = headings.length > 8 ? [4, 8, 12] : [3];

  positions.forEach(position => {
    if (!headings[position - 1]) {
      return;
    }

    const placeholder = document.createElement('div');

    placeholder.className = 'story-ad-placeholder';
    placeholder.setAttribute('aria-label', 'Advertisement position preview');
    placeholder.textContent = 'Advertisement';
    headings[position - 1].parentNode.insertBefore(placeholder, headings[position - 1]);
  });
}

function conciseStoryExcerpt(value) {
  const text = (value || '').replace(/\s+/g, ' ').trim();

  if (text.length <= 280) {
    return text;
  }

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  let excerpt = '';

  for (let index = 0; index < sentences.length; index += 1) {
    if (`${excerpt} ${sentences[index]}`.trim().length > 280) {
      break;
    }

    excerpt = `${excerpt} ${sentences[index]}`.trim();
  }

  if (excerpt.length > 100) {
    return excerpt;
  }

  return `${text.slice(0, 277).replace(/\s+\S*$/, '')}...`;
}

function nearbyStoryImage(heading) {
  let node = heading.previousElementSibling;
  let steps = 0;

  while (node && steps < 8) {
    const images = node.querySelectorAll ? node.querySelectorAll('img') : [];

    if (node.tagName === 'FIGURE' && node.querySelector('img')) {
      return node.querySelector('img');
    }

    if (images.length) {
      return images[images.length - 1];
    }

    if (node.tagName === 'H2') {
      break;
    }

    node = node.previousElementSibling;
    steps += 1;
  }

  return null;
}

function cleanStoryPickLabel(value) {
  return (value || '')
    .replace(/^shop\s+(this\s+|the\s+)?/i, '')
    .replace(/\s+here$/i, '')
    .replace(/\s+for\s+\$[\d,.]+$/i, '')
    .trim();
}

function isUsableStoryPickImage(image) {
  const src = image && (image.getAttribute('data-full-src') || image.getAttribute('src') || '');

  return Boolean(
    image &&
    !image.closest('.story-duplicate-hero') &&
    !/(rewardstyle|shopstyle|\.gif(?:\?|$)|pixel)/i.test(src)
  );
}

function safeStoryShopUrl(value) {
  const source = (value || '').trim();

  if (!source) {
    return '';
  }

  try {
    const url = new URL(source, window.location.origin);

    return /^(https?:)$/.test(url.protocol) ? url.href : '';
  } catch (error) {
    return '';
  }
}

function isAllowedStoryShopHost(value) {
  try {
    return SHOP_EMBED_HOST_PATTERN.test(new URL(value, window.location.origin).hostname);
  } catch (error) {
    return false;
  }
}

function insertStoryShopEmbed(container, sourceHtml) {
  const template = document.createElement('template');

  template.innerHTML = sourceHtml || '';
  Array.prototype.forEach.call(template.content.querySelectorAll('*'), node => {
    const tag = node.tagName.toLowerCase();

    if (['a', 'div', 'span', 'p', 'img', 'iframe', 'script'].indexOf(tag) === -1) {
      node.parentNode.removeChild(node);
      return;
    }

    Array.prototype.slice.call(node.attributes).forEach(attribute => {
      if (/^on/i.test(attribute.name)) {
        node.removeAttribute(attribute.name);
      }
    });

    if (tag === 'a') {
      const href = safeStoryShopUrl(node.getAttribute('href'));

      if (!href) {
        node.removeAttribute('href');
      } else {
        node.href = href;
        node.target = '_blank';
        node.rel = 'sponsored nofollow noopener';
      }
    }

    if (tag === 'img') {
      const src = safeStoryShopUrl(node.getAttribute('src'));

      if (!src) {
        node.parentNode.removeChild(node);
      } else {
        node.src = src;
        node.loading = 'lazy';
        node.decoding = 'async';
      }
    }

    if (tag === 'iframe') {
      const src = safeStoryShopUrl(node.getAttribute('src'));

      if (!src || !isAllowedStoryShopHost(src)) {
        node.parentNode.removeChild(node);
      } else {
        node.src = src;
        node.loading = 'lazy';
        node.title = node.title || 'Shop this product';
      }
    }

    if (tag === 'script') {
      const src = safeStoryShopUrl(node.getAttribute('src'));

      if (!src || !isAllowedStoryShopHost(src)) {
        node.parentNode.removeChild(node);
      }
    }
  });

  container.appendChild(template.content);
  Array.prototype.forEach.call(container.querySelectorAll('script[src]'), oldScript => {
    const script = document.createElement('script');

    Array.prototype.forEach.call(oldScript.attributes, attribute => {
      script.setAttribute(attribute.name, attribute.value);
    });
    script.async = true;
    oldScript.parentNode.replaceChild(script, oldScript);
  });

  if (container.querySelector('.shopthepost-widget[data-widget-id]')) {
    const rewardStyleScript = document.createElement('script');

    rewardStyleScript.src = 'https://widgets.rewardstyle.com/js/shopthepost.js';
    rewardStyleScript.async = true;
    container.appendChild(rewardStyleScript);
  }

  return Boolean(container.querySelector('iframe, img, a[href], [data-widget-id], [data-ltk-widget]'));
}

function storyShopEmbedLink(sourceHtml) {
  const template = document.createElement('template');

  template.innerHTML = sourceHtml || '';
  const link = template.content.querySelector('a[href]');
  const frame = template.content.querySelector('iframe[src]');

  if (link) {
    return safeStoryShopUrl(link.getAttribute('href'));
  }

  if (frame && isAllowedStoryShopHost(frame.getAttribute('src'))) {
    return safeStoryShopUrl(frame.getAttribute('src'));
  }

  return '';
}

function storyShopNativeProduct(sourceHtml) {
  const template = document.createElement('template');

  template.innerHTML = sourceHtml || '';
  const product = template.content.querySelector('[data-awaylands-product]');

  if (!product) {
    return null;
  }

  const href = safeStoryShopUrl(product.getAttribute('href') || product.getAttribute('data-url'));
  const image = safeStoryShopUrl(product.getAttribute('data-image'));

  if (!href || !image) {
    return null;
  }

  return {
    href,
    image,
    name: (product.getAttribute('data-name') || '').trim(),
    brand: (product.getAttribute('data-brand') || '').trim(),
    price: (product.getAttribute('data-price') || '').trim()
  };
}

function advancedStoryPickCandidates(el, isStyleEdit) {
  const candidates = [];
  const usedLinks = {};
  const usedImages = {};
  const availableImages = Array.prototype.filter.call(
    el.querySelectorAll('figure img'),
    isUsableStoryPickImage
  );
  let fallbackImageIndex = 0;
  let candidateOrder = 0;

  function relevanceScore(link, image, baseScore) {
    const label = cleanStoryPickLabel(link && link.textContent);
    const figure = link && link.closest('figure');
    const heading = link && link.closest('h2, h3');
    const context = `${label} ${heading ? heading.textContent : ''} ${figure ? figure.textContent : ''}`;
    let score = baseScore;

    if (image && figure && figure.contains(image)) {
      score += 18;
    }

    if (/\b(best|favorite|essential|recommend|top|must-have|gear|camera|lens|bag|dress|shoe|sandal|swim|speaker|pack)\b/i.test(context)) {
      score += 14;
    }

    if (label.length >= 8 && label.length <= 72) {
      score += 8;
    }

    if (/^(here|link|buy|available|learn more|see more|this item)$/i.test(label) || label.length < 4) {
      score -= 40;
    }

    return score;
  }

  function pickImage(preferred) {
    let image = isUsableStoryPickImage(preferred) ? preferred : null;
    let src = image && (image.getAttribute('data-full-src') || image.getAttribute('src') || '');

    if (image && !usedImages[src]) {
      usedImages[src] = true;
      return image;
    }

    while (fallbackImageIndex < availableImages.length) {
      image = availableImages[fallbackImageIndex];
      fallbackImageIndex += 1;
      src = image.getAttribute('data-full-src') || image.getAttribute('src') || '';

      if (!usedImages[src]) {
        usedImages[src] = true;
        return image;
      }
    }

    return null;
  }

  function addCandidate(link, image, baseScore) {
    const href = safeStoryShopUrl(link && link.getAttribute('href'));
    const label = cleanStoryPickLabel(link && link.textContent);

    if (!href || !label || usedLinks[href]) {
      return;
    }

    usedLinks[href] = true;
    const selectedImage = pickImage(image);

    candidates.push({
      href,
      image: selectedImage,
      label,
      relevance: relevanceScore(link, selectedImage, baseScore || 0),
      order: candidateOrder
    });
    candidateOrder += 1;
  }

  if (isStyleEdit) {
    const figures = el.querySelectorAll('figure.story-product-figure');

    Array.prototype.forEach.call(figures, figure => {
      const image = figure.querySelector('img');
      const link = figure.querySelector('a.story-affiliate-link');
      const src = image && (image.getAttribute('data-full-src') || image.getAttribute('src') || '');

      if (/south-of-france-outfit-ideas/i.test(src)) {
        addCandidate(link, image, 100);
      }
    });
  } else {
    const headings = el.querySelectorAll('h2, h3');

    Array.prototype.forEach.call(headings, heading => {
      const link = heading.querySelector('a.story-affiliate-link');

      if (link) {
        addCandidate(link, nearbyStoryImage(heading), 75);
      }
    });
  }

  const productFigures = el.querySelectorAll('figure.story-product-figure');

  Array.prototype.forEach.call(productFigures, figure => {
    addCandidate(
      figure.querySelector('a.story-affiliate-link'),
      figure.querySelector('img'),
      60
    );
  });

  const affiliateLinks = el.querySelectorAll('a.story-affiliate-link');

  Array.prototype.forEach.call(affiliateLinks, link => {
    const figure = link.closest('figure');

    addCandidate(link, figure && figure.querySelector('img'), 30);
  });

  return candidates.sort((left, right) => (
    right.relevance - left.relevance || left.order - right.order
  )).slice(0, 3);
}

function manualStoryPickCandidates(storyPage) {
  if (!storyPage) {
    return [];
  }

  return Array.prototype.map.call(
    storyPage.querySelectorAll('[data-story-shop-item]'),
    item => {
      const imageUrl = (item.getAttribute('data-image') || '').trim();
      const embedHtml = item.getAttribute('data-embed-html') || '';
      const nativeProduct = storyShopNativeProduct(embedHtml);
      let image = null;

      if (nativeProduct || imageUrl) {
        image = document.createElement('img');
        image.src = nativeProduct ? nativeProduct.image : imageUrl;
        image.alt = nativeProduct ? nativeProduct.name : (item.getAttribute('data-title') || '').trim();
      }

      return {
        href: (nativeProduct && nativeProduct.href) || safeStoryShopUrl(item.getAttribute('data-url')) || storyShopEmbedLink(embedHtml),
        label: (nativeProduct && nativeProduct.name) || (item.getAttribute('data-title') || '').trim() || 'Editor\'s Pick',
        brand: nativeProduct && nativeProduct.brand,
        price: nativeProduct && nativeProduct.price,
        nativeProduct: Boolean(nativeProduct),
        image,
        embedHtml: nativeProduct ? '' : embedHtml
      };
    }
  ).filter(item => (item.href && item.label) || item.embedHtml);
}

function mergedStoryPickCandidates(el, storyPage, isStyleEdit) {
  const manualCandidates = manualStoryPickCandidates(storyPage);
  const automaticCandidates = advancedStoryPickCandidates(el, isStyleEdit);
  const targetCount = Math.max(3, manualCandidates.length);
  const used = {};
  const picks = [];

  manualCandidates.concat(automaticCandidates).forEach(pick => {
    const isAutomatic = manualCandidates.indexOf(pick) === -1;
    const key = pick.href || pick.embedHtml;

    if (!key || used[key] || (isAutomatic && picks.length >= targetCount)) {
      return;
    }

    used[key] = true;
    picks.push(pick);
  });

  return picks;
}

function buildAdvancedStoryOverview(el, storyPage, isStyleEdit) {
  const article = storyPage.querySelector('.story-article');
  const paragraphs = el.querySelectorAll('p');
  const overviewHeadings = storySectionHeadings(el);
  let source = null;

  for (let index = 0; index < paragraphs.length; index += 1) {
    if ((paragraphs[index].textContent || '').trim().length > 100) {
      source = paragraphs[index];
      break;
    }
  }

  const manualSummary = (storyPage.getAttribute('data-at-a-glance-summary') || '').trim();

  if (!article || (!source && !manualSummary)) {
    return;
  }

  const overview = document.createElement('section');
  const kicker = document.createElement('p');
  const title = document.createElement('h2');
  const summary = document.createElement('p');
  const links = document.createElement('ul');

  overview.className = 'story-overview';
  overview.setAttribute('aria-labelledby', 'story-overview-title');
  kicker.className = 'story-overview__kicker';
  kicker.textContent = (storyPage.getAttribute('data-at-a-glance-kicker') || '').trim() ||
    (isStyleEdit ? 'The edit, quickly' : 'The guide, quickly');
  title.id = 'story-overview-title';
  title.className = 'story-overview__title';
  title.textContent = (storyPage.getAttribute('data-at-a-glance-title') || '').trim() || 'At a glance';
  summary.className = 'story-overview__summary';
  summary.textContent = manualSummary || conciseStoryExcerpt(source.textContent);
  links.className = 'story-overview__links';

  for (let index = 0; index < 3; index += 1) {
    const selectedSection = (storyPage.getAttribute(`data-at-a-glance-item-${index + 1}-section`) || '').trim();
    const hasSelectedSection = /^\d+$/.test(selectedSection);
    const selectedIndex = hasSelectedSection ? parseInt(selectedSection, 10) - 1 : index;
    const heading = overviewHeadings[selectedIndex];
    const manualTitle = (storyPage.getAttribute(`data-at-a-glance-item-${index + 1}-title`) || '').trim();
    const manualLink = (storyPage.getAttribute(`data-at-a-glance-item-${index + 1}-link`) || '').trim();
    const headingTitle = heading ? storyTocTitle(heading.textContent) : '';
    const headingLink = heading ? `#${heading.id}` : '';
    const itemTitle = hasSelectedSection ? headingTitle : (manualTitle || headingTitle);
    const itemLink = hasSelectedSection ? headingLink : (manualLink || headingLink);

    if (!itemTitle || !itemLink) {
      continue;
    }

    const item = document.createElement('li');
    const link = document.createElement('a');
    const number = document.createElement('span');

    number.textContent = `0${index + 1}`;
    link.href = itemLink;
    link.appendChild(number);
    link.appendChild(document.createTextNode(itemTitle));
    item.appendChild(link);
    links.appendChild(item);
  }

  overview.appendChild(kicker);
  overview.appendChild(title);
  overview.appendChild(summary);
  if (links.children.length) {
    overview.appendChild(links);
  }
  article.insertBefore(overview, el);
}

function cleanSidebarStoryTitle(sourceTitle) {
  const manualTitle = (sourceTitle.getAttribute('data-sidebar-title') || '').trim();

  if (manualTitle) {
    return manualTitle;
  }

  let title = (sourceTitle.textContent || '').trim().replace(/\s*\([^)]*\)\s*$/, '');

  if (title.length > 64 && title.indexOf(' - ') !== -1) {
    title = title.split(' - ')[0].trim();
  }

  if (title.length > 64 && title.indexOf(':') !== -1) {
    title = title.split(':')[0].trim();
  }

  return title;
}

function shouldUseAdvancedStory(el, storyPage) {
  if (!storyPage) {
    return false;
  }

  if (isAdvancedStoryPreview()) {
    return true;
  }

  const layout = storyPage.getAttribute('data-page-layout') || 'auto';

  if (layout === 'sidebar') {
    return true;
  }

  if (layout === 'simple') {
    return false;
  }

  const type = storyPage.getAttribute('data-story-type') || 'standard';
  const headingCount = storySectionHeadings(el).length;
  const affiliateCount = el.querySelectorAll('a.story-affiliate-link').length;
  const textLength = (el.textContent || '').replace(/\s+/g, ' ').trim().length;

  if (type === 'quick-answer') {
    return false;
  }

  return (
    type === 'guide' ||
    type === 'review' ||
    type === 'style-shopping' ||
    affiliateCount >= 3 ||
    (headingCount >= 4 && textLength >= 3200)
  );
}

function finalizeRelatedStories(storyPage) {
  if (!storyPage) {
    return;
  }

  const items = storyPage.querySelectorAll('.story-article__modules .related-stories__list > li');
  const used = {};
  let kept = 0;

  Array.prototype.forEach.call(items, item => {
    const link = item.querySelector('a[href]');
    const key = link && (link.getAttribute('href') || link.textContent || '').trim().toLowerCase();

    if (!key || used[key] || kept >= 6) {
      item.parentNode.removeChild(item);
      return;
    }

    used[key] = true;
    item.hidden = false;
    item.removeAttribute('aria-hidden');
    item.setAttribute('data-related-position', String(kept + 1));
    kept += 1;
  });
}

function buildAdvancedStoryRail(el, storyPage, isStyleEdit) {
  const toc = storyPage.querySelector('[data-story-toc]');

  if (!toc) {
    return;
  }

  const shopEditEnabled = storyPage.getAttribute('data-shop-edit-enabled') !== 'false';
  const picks = shopEditEnabled ? mergedStoryPickCandidates(el, storyPage, isStyleEdit) : [];
  const picksSection = document.createElement('section');
  const picksKicker = document.createElement('p');
  const picksTitle = document.createElement('h2');
  const picksList = document.createElement('div');
  const customPicksTitle = (storyPage.getAttribute('data-shop-edit-title') || '').trim();
  const picksHeading = customPicksTitle || 'Shop The Edit';

  toc.classList.add('story-rail');
  picksSection.className = 'story-rail__section story-rail__picks';
  picksSection.id = 'story-rail-picks';
  picksKicker.className = 'story-rail__kicker';
  picksKicker.textContent = 'Editor\'s shortlist';
  picksTitle.className = 'story-rail__title';
  picksTitle.textContent = picksHeading;
  picksList.className = 'story-rail__pick-list';

  picks.forEach((pick, index) => {
    const card = document.createElement(pick.embedHtml ? 'div' : 'a');
    const count = document.createElement('span');
    const label = document.createElement(pick.embedHtml && pick.href ? 'a' : 'span');

    card.className = 'story-rail__pick';
    if (pick.embedHtml) {
      card.classList.add('story-rail__pick--embed');
    }
    if (!pick.embedHtml) {
      card.href = pick.href;
      card.target = '_blank';
      card.rel = 'sponsored nofollow noopener';
    }
    if (pick.embedHtml && pick.href) {
      label.href = pick.href;
      label.target = '_blank';
      label.rel = 'sponsored nofollow noopener';
    }

    if (pick.image) {
      const media = document.createElement('span');
      const image = document.createElement('img');

      media.className = 'story-rail__pick-media';
      image.src = pick.image.getAttribute('src');
      image.alt = pick.image.getAttribute('alt') || pick.label;
      image.loading = 'lazy';
      image.decoding = 'async';
      media.appendChild(image);
      card.appendChild(media);
    } else {
      card.classList.add('story-rail__pick--text-only');
    }

    if (pick.embedHtml) {
      const embed = document.createElement('div');
      embed.className = 'story-rail__pick-embed';
      if (insertStoryShopEmbed(embed, pick.embedHtml)) {
        card.appendChild(embed);
      }
    }

    count.className = 'story-rail__pick-number';
    count.textContent = `0${index + 1}`;
    label.className = 'story-rail__pick-name';
    if (pick.nativeProduct) {
      const brand = document.createElement('span');
      const name = document.createElement('span');
      const price = document.createElement('span');
      const action = document.createElement('span');

      label.classList.add('story-rail__pick-product-copy');
      brand.className = 'story-rail__pick-brand';
      brand.textContent = pick.brand || 'Revolve';
      name.className = 'story-rail__pick-product-name';
      name.textContent = pick.label || 'Editor\'s Pick';
      price.className = 'story-rail__pick-price';
      price.textContent = pick.price || '';
      action.className = 'story-rail__pick-action';
      action.textContent = 'Shop the List';
      label.appendChild(brand);
      label.appendChild(name);
      if (pick.price) {
        label.appendChild(price);
      }
      label.appendChild(action);
    } else {
      label.textContent = pick.label || 'Editor\'s Pick';
    }
    card.appendChild(count);
    card.appendChild(label);
    picksList.appendChild(card);
  });

  picksSection.appendChild(picksKicker);
  picksSection.appendChild(picksTitle);
  picksSection.appendChild(picksList);

  const utility = document.createElement('nav');
  const utilityLabel = document.createElement('p');
  const overviewLink = document.createElement('a');
  const picksLink = document.createElement('a');

  utility.className = 'story-rail__utility';
  utility.setAttribute('aria-label', 'Story shortcuts');
  utilityLabel.className = 'story-rail__utility-label';
  utilityLabel.textContent = 'Jump to';
  overviewLink.href = '#story-overview-title';
  overviewLink.textContent = 'At a glance';
  picksLink.href = '#story-rail-picks';
  picksLink.textContent = picksHeading;
  utility.appendChild(utilityLabel);
  utility.appendChild(overviewLink);
  if (picks.length) {
    utility.appendChild(picksLink);
  }

  const trustSection = document.createElement('section');
  const trustKicker = document.createElement('p');
  const trustTitle = document.createElement('h2');
  const trustText = document.createElement('p');

  trustSection.className = 'story-rail__section story-rail__trust';
  trustKicker.className = 'story-rail__kicker';
  trustKicker.textContent = (storyPage.getAttribute('data-expertise-kicker') || '').trim() || 'About the Author';
  trustTitle.className = 'story-rail__title';
  trustTitle.textContent = (storyPage.getAttribute('data-expertise-title') || '').trim() || 'Why trust this guide';
  trustText.className = 'story-rail__trust-text';
  trustText.textContent = (storyPage.getAttribute('data-expertise-text') || '').trim() || 'Amy Seder is a professional travel photographer with more than a decade of field experience.';
  trustSection.appendChild(trustKicker);
  trustSection.appendChild(trustTitle);
  trustSection.appendChild(trustText);

  toc.appendChild(utility);
  if (picks.length) {
    toc.appendChild(picksSection);

    const mobileShopEdit = window.matchMedia('(max-width: 899px)');
    const placeShopEdit = event => {
      if (event.matches) {
        el.parentNode.insertBefore(picksSection, el);
      } else {
        toc.insertBefore(picksSection, trustSection.parentNode === toc ? trustSection : null);
      }
    };

    placeShopEdit(mobileShopEdit);
    if (mobileShopEdit.addEventListener) {
      mobileShopEdit.addEventListener('change', placeShopEdit);
    } else {
      mobileShopEdit.addListener(placeShopEdit);
    }
  }
  toc.appendChild(trustSection);

  const relatedItems = storyPage.querySelectorAll('.story-article__modules .related-stories__list > li');

  if (relatedItems.length) {
    const relatedSection = document.createElement('section');
    const relatedKicker = document.createElement('p');
    const relatedTitle = document.createElement('h2');
    const relatedList = document.createElement('ul');

    relatedSection.className = 'story-rail__section story-rail__related';
    relatedKicker.className = 'story-rail__kicker';
    relatedKicker.textContent = (storyPage.getAttribute('data-keep-reading-kicker') || '').trim() || 'Keep reading';
    relatedTitle.className = 'story-rail__title';
    relatedTitle.textContent = (storyPage.getAttribute('data-keep-reading-title') || '').trim() || 'More from Away Lands';
    relatedList.className = 'story-rail__related-list';

    Array.prototype.slice.call(relatedItems, 0, 3).forEach(item => {
      const sourceLink = item.querySelector('a[href]');
      const sourceImage = item.querySelector('.related-stories__image img');
      const sourceTitle = item.querySelector('.related-stories__title');

      if (!sourceLink || !sourceTitle) {
        return;
      }

      const listItem = document.createElement('li');
      const link = document.createElement('a');
      const title = document.createElement('span');

      link.className = 'story-rail__related-link';
      link.href = sourceLink.getAttribute('href');

      if (sourceImage) {
        const media = document.createElement('span');
        const image = document.createElement('img');

        media.className = 'story-rail__related-media';
        image.src = sourceImage.currentSrc || sourceImage.getAttribute('src');
        image.alt = sourceImage.getAttribute('alt') || sourceTitle.textContent.trim();
        image.loading = 'lazy';
        image.decoding = 'async';
        media.appendChild(image);
        link.appendChild(media);
      }

      title.className = 'story-rail__related-name';
      title.textContent = cleanSidebarStoryTitle(sourceTitle);
      link.appendChild(title);
      listItem.appendChild(link);
      relatedList.appendChild(listItem);
    });

    Array.prototype.slice.call(relatedItems, 0, 3).forEach(item => {
      item.hidden = true;
      item.style.display = 'none';
      item.setAttribute('aria-hidden', 'true');
    });

    Array.prototype.slice.call(relatedItems, 3, 6).forEach(item => {
      item.hidden = false;
      item.style.display = 'block';
      item.removeAttribute('aria-hidden');
    });

    relatedSection.appendChild(relatedKicker);
    relatedSection.appendChild(relatedTitle);
    relatedSection.appendChild(relatedList);
    toc.appendChild(relatedSection);
  }

  toc.hidden = false;
}

function positionAdvancedMobileRail(storyPage) {
  const rail = storyPage.querySelector('.story-rail');
  const trust = storyPage.querySelector('.story-rail__trust');
  const body = storyPage.querySelector('.story-article__body');

  if (!rail || !trust || !body) {
    return;
  }

  if (!trust._storyRailPlaceholder) {
    trust._storyRailPlaceholder = document.createComment('story-trust-position');
    trust.parentNode.insertBefore(trust._storyRailPlaceholder, trust);
  }

  const updatePosition = () => {
    if (window.innerWidth <= 899) {
      const headings = body.querySelectorAll('h2');
      const target = headings.length > 1 ? headings[1] : null;

      trust.classList.add('story-rail__trust--inline');

      if (target) {
        body.insertBefore(trust, target);
      } else {
        body.appendChild(trust);
      }
    } else {
      trust.classList.remove('story-rail__trust--inline');
      trust._storyRailPlaceholder.parentNode.insertBefore(trust, trust._storyRailPlaceholder.nextSibling);
    }
  };

  updatePosition();

  if (!storyPage.hasAttribute('data-story-rail-responsive')) {
    storyPage.setAttribute('data-story-rail-responsive', 'true');
    window.addEventListener('resize', updatePosition);
  }
}

function prepareAdvancedStoryPreview(el) {
  const storyPage = el.closest('[data-story-page]');

  if (!storyPage || !shouldUseAdvancedStory(el, storyPage) || storyPage.classList.contains('story-page--advanced')) {
    return;
  }

  const isStyleEdit = storyPage.getAttribute('data-story-type') === 'style-shopping';

  storyPage.classList.add('story-page--advanced');
  document.body.classList.add('body--story-advanced-preview');
  buildAdvancedStoryOverview(el, storyPage, isStyleEdit);
  buildAdvancedStoryRail(el, storyPage, isStyleEdit);
  positionAdvancedMobileRail(storyPage);
}

function buildPastedStoryTables(el) {
  const sources = el.querySelectorAll('[data-story-table-paste]');

  Array.prototype.forEach.call(sources, source => {
    const table = source.parentNode.querySelector('[data-story-table-target]');
    const requestedColumns = parseInt(source.getAttribute('data-columns'), 10);
    const columnCount = Math.max(1, requestedColumns || 3);
    const values = (source.textContent || '')
      .split(/\r?\n|\t/)
      .map(value => value.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (!table || values.length < columnCount) {
      return;
    }

    const head = document.createElement('thead');
    const headingRow = document.createElement('tr');

    values.slice(0, columnCount).forEach(value => {
      const heading = document.createElement('th');
      heading.setAttribute('scope', 'col');
      heading.textContent = value;
      headingRow.appendChild(heading);
    });

    head.appendChild(headingRow);

    const body = document.createElement('tbody');
    const cells = values.slice(columnCount);

    for (let index = 0; index < cells.length; index += columnCount) {
      const row = document.createElement('tr');

      for (let column = 0; column < columnCount; column += 1) {
        const cell = document.createElement('td');
        cell.textContent = cells[index + column] || '';
        row.appendChild(cell);
      }

      body.appendChild(row);
    }

    table.innerHTML = '';
    table.appendChild(head);
    table.appendChild(body);
    source.parentNode.removeChild(source);
  });
}

function prepareStory(el) {
  placeInlineHtmlBlocks(el);
  buildPastedStoryTables(el);
  normalizeInlineLinkSpaces(el);
  normalizeStoryLinks(el);
  normalizeStoryHeadings(el);
  optimizeStoryImages(el);
  enhanceAffiliateLinks(el);
  linkImagesFromLinkedCaptions(el);
  enhancePhotoCaptions(el);
  enhanceCommerceEmbeds(el);
  enhanceLtkWidgets(el);
  promoteQuickAnswer(el);
  buildStoryContents(el);
  removeDuplicateHero(el);
  groupStoryFigures(el);
  normalizeStorySpacing(el);
  addPreviewAdPlaceholders(el);
  finalizeRelatedStories(el.closest('[data-story-page]'));
  prepareAdvancedStoryPreview(el);
  addCommissionDisclosure(el);
  observeStoryEnhancements(el);
}

function resetMediumFigureLayout(figures) {
  Array.prototype.forEach.call(figures, figure => {
    figure.style.width = '';
    figure.style.marginTop = '';
    figure.style.removeProperty('--story-pair-width');
  });
}

function alignPairedMediumFigures(el) {
  const figures = el.querySelectorAll('figure.medium');

  resetMediumFigureLayout(figures);
}

function lightboxStoryImages(el) {
  return Array.prototype.filter.call(
    el.querySelectorAll('figure img'),
    image => !image.closest('a[href]')
  );
}

export default {
  name: 'story',
  bind(el) {
    prepareStory(el);

    new ImagesLoaded(el, () => {
      alignPairedMediumFigures(el);
      new LuminousGallery(lightboxStoryImages(el), galleryOpts, opts);
    });
  },
  inserted(el) {
    prepareStory(el);
    alignPairedMediumFigures(el);

    window.setTimeout(() => normalizeInlineLinkSpaces(el), 0);
  }
};
