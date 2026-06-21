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

  return 1600;
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

function optimizeStoryImages(el) {
  const images = el.querySelectorAll('img');

  Array.prototype.forEach.call(images, (image, index) => {
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

    if (!image.hasAttribute('decoding')) {
      image.setAttribute('decoding', 'async');
    }

    if (!image.hasAttribute('loading')) {
      image.setAttribute('loading', index === 0 ? 'eager' : 'lazy');
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
    optimizeStoryImages(el);

    new ImagesLoaded(el, () => {
      alignPairedMediumFigures(el);
      new LuminousGallery(el.querySelectorAll('figure img'), galleryOpts, opts);
    });
  },
  inserted(el) {
    normalizeInlineLinkSpaces(el);
    optimizeStoryImages(el);
    alignPairedMediumFigures(el);

    window.setTimeout(() => normalizeInlineLinkSpaces(el), 0);
  }
};
