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

function imageAspectRatio(figure) {
  const image = figure.querySelector('img');

  if (!image || !image.naturalWidth || !image.naturalHeight) {
    return null;
  }

  return image.naturalWidth / image.naturalHeight;
}

function resetMediumFigureLayout(figures) {
  Array.prototype.forEach.call(figures, figure => {
    figure.style.width = '';
    figure.style.marginTop = '';
  });
}

function alignPairedMediumFigures(el) {
  const figures = el.querySelectorAll('figure.medium');

  resetMediumFigureLayout(figures);

  for (let index = 0; index < figures.length; index += 1) {
    const figure = figures[index];
    const next = figure.nextElementSibling;

    if (!next || !next.classList.contains('medium')) {
      continue;
    }

    const firstRatio = imageAspectRatio(figure);
    const secondRatio = imageAspectRatio(next);

    if (!firstRatio || !secondRatio) {
      continue;
    }

    const totalRatio = firstRatio + secondRatio;
    const firstWidth = (firstRatio / totalRatio) * 100;
    const secondWidth = (secondRatio / totalRatio) * 100;

    figure.style.width = `${firstWidth}%`;
    next.style.width = `${secondWidth}%`;
    next.style.marginTop = window.getComputedStyle(figure).marginTop;
    index += 1;
  }
}

export default {
  name: 'story',
  bind(el) {
    normalizeInlineLinkSpaces(el);

    new ImagesLoaded(el, () => {
      alignPairedMediumFigures(el);
      new LuminousGallery(el.querySelectorAll('figure img'), galleryOpts, opts);
    });
  },
  inserted(el) {
    normalizeInlineLinkSpaces(el);
    alignPairedMediumFigures(el);

    window.setTimeout(() => normalizeInlineLinkSpaces(el), 0);
  }
};
