import {LuminousGallery} from '../luminous';

const ImagesLoaded = require('imagesloaded');

const opts = {
  sourceAttribute: 'src'
};

const galleryOpts = {
  arrowNavigation: true
};

const TEXT_NODE = 3;

function normalizeInlineLinkSpaces(el) {
  const links = el.querySelectorAll('a');

  Array.prototype.forEach.call(links, link => {
    const firstNode = link.firstChild;
    const previousNode = link.previousSibling;
    const hasLeadingSpace = firstNode && firstNode.nodeType === TEXT_NODE && /^\s+/.test(firstNode.nodeValue);
    const needsSpace = previousNode &&
      previousNode.nodeType === TEXT_NODE &&
      previousNode.nodeValue &&
      !/\s$/.test(previousNode.nodeValue) &&
      /^[A-Za-z0-9]/.test(link.textContent || '');

    if (hasLeadingSpace) {
      firstNode.nodeValue = firstNode.nodeValue.replace(/^\s+/, '');
    }

    if (needsSpace) {
      previousNode.nodeValue += ' ';
    }
  });
}

export default {
  name: 'story',
  bind(el) {
    normalizeInlineLinkSpaces(el);

    new ImagesLoaded(el, () => {
      new LuminousGallery(el.querySelectorAll('figure img'), galleryOpts, opts);
    });
  },
  inserted(el) {
    normalizeInlineLinkSpaces(el);

    window.setTimeout(() => normalizeInlineLinkSpaces(el), 0);
  }
};
