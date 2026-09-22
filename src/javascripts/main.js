import objectFitImages from 'object-fit-images';

import Vue from 'vue';

import PageHeader from './components/header';
import InstaFeed from './components/insta-feed.vue';
import Listings from './components/listings.vue';
import initSearch from './components/search';
import initDestinations3Postcards from './components/destinations3-postcards';
import initFilmGallery from './components/film-gallery';

const enableDragScrolling = track => {
  if (!track || track.dataset.dragScrolling === 'true') {
    return;
  }

  let pointerId = null;
  let startX = 0;
  let startScrollLeft = 0;
  let dragged = false;

  track.dataset.dragScrolling = 'true';
  track.addEventListener('pointerdown', event => {
    // Touchscreens get smoother momentum from the browser's native overflow
    // scrolling. Pointer dragging is retained for mouse and pen input.
    if (event.pointerType === 'touch') {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    pointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = track.scrollLeft;
    dragged = false;
    track.classList.add('is-dragging');
    track.setPointerCapture(pointerId);
  });
  track.addEventListener('pointermove', event => {
    if (pointerId !== event.pointerId) {
      return;
    }
    const distance = event.clientX - startX;

    if (Math.abs(distance) > 5) {
      dragged = true;
    }
    track.scrollLeft = startScrollLeft - distance;
    if (dragged) {
      event.preventDefault();
    }
  });
  const finishDrag = event => {
    if (pointerId !== event.pointerId) {
      return;
    }
    if (track.hasPointerCapture(pointerId)) {
      track.releasePointerCapture(pointerId);
    }
    pointerId = null;
    track.classList.remove('is-dragging');
    if (dragged) {
      track.dataset.suppressClickUntil = String(Date.now() + 350);
    }
  };
  track.addEventListener('pointerup', finishDrag);
  track.addEventListener('pointercancel', finishDrag);
  track.addEventListener('click', event => {
    if (Number(track.dataset.suppressClickUntil || 0) > Date.now()) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
};

const initBlogDragCarousels = () => {
  document.querySelectorAll('.bm-products__track, .bm-itineraries__grid').forEach(enableDragScrolling);
};

const enableInfiniteCarousel = (track, cardSelector) => {
  if (!track || track.dataset.infiniteCarousel === 'true') {
    return;
  }
  const originals = Array.prototype.slice.call(track.querySelectorAll(cardSelector));

  if (originals.length < 2) {
    return;
  }

  let setWidth = 0;
  let normalizing = false;
  let resizeTimer = null;
  const setInstantScroll = left => {
    const previousBehavior = track.style.scrollBehavior;

    track.style.scrollBehavior = 'auto';
    track.scrollLeft = left;
    track.style.scrollBehavior = previousBehavior;
  };
  const buildCopies = () => {
    track.querySelectorAll('[data-carousel-copy]').forEach(copy => copy.parentNode.removeChild(copy));
    const style = window.getComputedStyle(track);
    const gap = parseFloat(style.columnGap || style.gap) || 0;

    setWidth = originals.reduce((width, card) => (
      width + card.getBoundingClientRect().width + gap
    ), 0);
    if (!setWidth) {
      return;
    }

    const before = document.createDocumentFragment();
    const after = document.createDocumentFragment();

    originals.forEach(card => {
      const leadingCopy = card.cloneNode(true);
      const trailingCopy = card.cloneNode(true);

      leadingCopy.dataset.carouselCopy = 'before';
      trailingCopy.dataset.carouselCopy = 'after';
      leadingCopy.setAttribute('aria-hidden', 'true');
      trailingCopy.setAttribute('aria-hidden', 'true');
      leadingCopy.setAttribute('tabindex', '-1');
      trailingCopy.setAttribute('tabindex', '-1');
      before.appendChild(leadingCopy);
      after.appendChild(trailingCopy);
    });
    track.insertBefore(before, originals[0]);
    track.appendChild(after);
    setInstantScroll(setWidth);
  };
  const normalizePosition = () => {
    if (normalizing || !setWidth) {
      return;
    }
    if (track.scrollLeft < setWidth * 0.5 || track.scrollLeft > setWidth * 1.5) {
      normalizing = true;
      const destination = track.scrollLeft < setWidth * 0.5 ?
        track.scrollLeft + setWidth :
        track.scrollLeft - setWidth;

      setInstantScroll(destination);
      window.requestAnimationFrame(() => {
        normalizing = false;
      });
    }
  };

  track.dataset.infiniteCarousel = 'true';
  buildCopies();
  track.addEventListener('scroll', normalizePosition, {passive: true});
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(buildCopies, 180);
  });
};

const initBlogInfiniteCarousels = () => {
  enableInfiniteCarousel(document.querySelector('.bm-products__track'), '.bm-product:not([data-carousel-copy])');
  enableInfiniteCarousel(document.querySelector('.bm-itineraries__grid'), '.bm-itinerary-card:not([data-carousel-copy])');
};

const initBlogItineraryCarousel = () => {
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-itinerary-direction]');
    if (!button) {
      return;
    }
    const section = button.closest('.bm-itineraries');
    const track = section && section.querySelector('.bm-itineraries__grid');
    const card = track && track.querySelector('.bm-itinerary-card');
    if (!track || !card) {
      return;
    }
    const direction = button.dataset.itineraryDirection === 'previous' ? -1 : 1;
    const step = card.getBoundingClientRect().width + 16;
    track.scrollBy({left: direction * step, behavior: 'smooth'});
  });
};

const initBlogProductCarousel = () => {
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-product-direction]');
    if (!button) {
      return;
    }
    const section = button.closest('.bm-products');
    const track = section && section.querySelector('.bm-products__track');
    const card = track && track.querySelector('.bm-product');
    if (!track || !card) {
      return;
    }
    const direction = button.dataset.productDirection === 'previous' ? -1 : 1;
    const step = card.getBoundingClientRect().width + 8;
    track.scrollBy({left: direction * step, behavior: 'smooth'});
  });
};

const initCategorySubcategories = () => {
  const navigation = document.querySelector('.category-subcategory-nav');
  if (!navigation) {
    return;
  }

  const triggers = Array.from(navigation.querySelectorAll('[data-subcategory-trigger]'));
  const panels = Array.from(navigation.querySelectorAll('[data-subcategory-panel]'));
  if (!triggers.length || !panels.length) {
    return;
  }

  navigation.addEventListener('click', event => {
    const trigger = event.target.closest('[data-subcategory-trigger]');
    if (!trigger) {
      return;
    }
    event.preventDefault();

    const wasExpanded = trigger.getAttribute('aria-expanded') === 'true';
    triggers.forEach(item => item.setAttribute('aria-expanded', 'false'));
    panels.forEach(panel => {
      panel.hidden = true;
    });

    if (wasExpanded) {
      return;
    }

    const panel = navigation.querySelector(`#${trigger.dataset.subcategoryPanel}`);
    if (!panel) {
      return;
    }
    trigger.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    panel.scrollIntoView({behavior: 'smooth', block: 'start'});
  });
};

const initCategoryNavPreview = () => {
  const preview = document.querySelector('[data-category-nav-preview]');
  if (!preview) {
    return;
  }

  preview.addEventListener('click', event => {
    const button = event.target.closest('[data-category-nav-select]');
    if (!button) {
      return;
    }
    const selected = button.dataset.categoryNavSelect;

    preview.querySelectorAll('[data-category-nav-select]').forEach(item => {
      item.classList.toggle('is-active', item === button);
    });
    preview.querySelectorAll('[data-category-nav-option]').forEach(option => {
      const active = option.dataset.categoryNavOption === selected;
      option.hidden = !active;
      option.classList.toggle('is-active', active);
    });
  });

  preview.addEventListener('change', event => {
    if (!event.target.matches('[data-category-nav-option="3"] select')) {
      return;
    }
    if (event.target.value) {
      window.location.href = event.target.value;
    }
  });
};

const initCategoryArchivePagination = () => {
  const listing = document.querySelector('[data-category-archive-page-size]');
  const navigation = document.querySelector('[data-category-archive-pagination]');
  if (!listing || !navigation) {
    return;
  }

  const cards = Array.from(listing.querySelectorAll('[data-category-archive-card]'));
  const pageSize = Number(listing.dataset.categoryArchivePageSize) || 12;
  const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));
  const parameters = new URLSearchParams(window.location.search);
  const requestedPage = Number(parameters.get('archive-page')) || 1;
  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;

  cards.forEach((card, index) => {
    card.hidden = index < start || index >= end;
  });

  if (totalPages <= 1) {
    navigation.hidden = true;
    return;
  }

  const pageHref = page => {
    const nextParameters = new URLSearchParams(window.location.search);
    if (page === 1) {
      nextParameters.delete('archive-page');
    } else {
      nextParameters.set('archive-page', page);
    }
    const query = nextParameters.toString();
    return `${window.location.pathname}${query ? `?${query}` : ''}#all-stories`;
  };

  const addLink = (label, page, options = {}) => {
    const link = document.createElement(options.disabled ? 'span' : 'a');
    link.textContent = label;
    if (!options.disabled) {
      link.href = pageHref(page);
    }
    if (options.current) {
      link.className = 'is-current';
      link.setAttribute('aria-current', 'page');
    }
    if (options.disabled) {
      link.className = 'is-disabled';
    }
    navigation.appendChild(link);
  };

  addLink('Previous', currentPage - 1, {disabled: currentPage === 1});

  const visiblePages = [1, currentPage - 1, currentPage, currentPage + 1, totalPages]
    .filter(page => page >= 1 && page <= totalPages)
    .filter((page, index, pages) => pages.indexOf(page) === index)
    .sort((a, b) => a - b);

  visiblePages.forEach((page, index) => {
    if (index && page - visiblePages[index - 1] > 1) {
      const separator = document.createElement('span');
      separator.className = 'destination-archive__pagination-ellipsis';
      separator.textContent = '…';
      navigation.appendChild(separator);
    }
    addLink(String(page), page, {current: page === currentPage});
  });

  addLink('Next', currentPage + 1, {disabled: currentPage === totalPages});
};

const initCategoryIndexes = () => {
  document.querySelectorAll('[data-category-index]').forEach(index => {
    const button = index.querySelector('[data-category-index-toggle]');
    const label = index.querySelector('[data-category-index-label]');
    const extraItems = Array.from(index.querySelectorAll('[data-category-index-extra]'));
    if (!button || !label || !extraItems.length) {
      return;
    }

    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      extraItems.forEach(item => {
        item.hidden = expanded;
      });
      button.setAttribute('aria-expanded', String(!expanded));
      label.textContent = expanded ? 'See the Full Index' : 'See Less';
    });
  });
};

import Imageloaded from './directives/imageloaded';
import Slides from './directives/slides';
import Gallery from './directives/gallery';
import Story from './directives/story';

Vue.config.productionTip = false;

const makeDocumentIdsUnique = () => {
  const seen = {};

  Array.from(document.querySelectorAll('[id]')).forEach(element => {
    const original = element.id;
    const count = seen[original] || 0;
    seen[original] = count + 1;

    if (count) {
      element.id = `${original}-duplicate-${count}`;
    }
  });
};

makeDocumentIdsUnique();

// RewardStyle scripts have already run while the document was parsed. Removing
// their nodes keeps Vue from compiling them as template content.
Array.prototype.forEach.call(document.querySelectorAll('.shopthepost-widget script'), script => {
  script.parentNode.removeChild(script);
});

export const eventBus = new Vue();

export default new Vue({
  el: '#app',
  mounted() {
    objectFitImages();
    initSearch();
    initDestinations3Postcards();
    initFilmGallery();
    initBlogItineraryCarousel();
    initBlogProductCarousel();
    initBlogInfiniteCarousels();
    initBlogDragCarousels();
    initCategorySubcategories();
    initCategoryNavPreview();
    initCategoryArchivePagination();
    initCategoryIndexes();
  },
  methods: {},
  components: {
    pageheader: PageHeader,
    instafeed: InstaFeed,
    listings: Listings
  },
  directives: {
    Imageloaded,
    Slides,
    Gallery,
    Story
  }
});
