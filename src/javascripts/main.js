import objectFitImages from 'object-fit-images';

import Vue from 'vue';

import PageHeader from './components/header';
import InstaFeed from './components/insta-feed.vue';
import Listings from './components/listings.vue';
import initSearch from './components/search';
import initDestinations3Postcards from './components/destinations3-postcards';
import initFilmGallery from './components/film-gallery';

const enableDragScrolling = track => {
  if (!track || track.dataset.dragScrolling === 'true') return;

  let pointerId = null;
  let startX = 0;
  let startScrollLeft = 0;
  let dragged = false;

  track.dataset.dragScrolling = 'true';
  track.addEventListener('pointerdown', event => {
    // Touchscreens get smoother momentum from the browser's native overflow
    // scrolling. Pointer dragging is retained for mouse and pen input.
    if (event.pointerType === 'touch') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = track.scrollLeft;
    dragged = false;
    track.classList.add('is-dragging');
    track.setPointerCapture(pointerId);
  });
  track.addEventListener('pointermove', event => {
    if (pointerId !== event.pointerId) return;
    const distance = event.clientX - startX;

    if (Math.abs(distance) > 5) dragged = true;
    track.scrollLeft = startScrollLeft - distance;
    if (dragged) event.preventDefault();
  });
  const finishDrag = event => {
    if (pointerId !== event.pointerId) return;
    if (track.hasPointerCapture(pointerId)) track.releasePointerCapture(pointerId);
    pointerId = null;
    track.classList.remove('is-dragging');
    if (dragged) track.dataset.suppressClickUntil = String(Date.now() + 350);
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
  if (!track || track.dataset.infiniteCarousel === 'true') return;
  const originals = Array.prototype.slice.call(track.querySelectorAll(cardSelector));

  if (originals.length < 2) return;

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
    if (!setWidth) return;

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
    if (normalizing || !setWidth) return;
    if (track.scrollLeft < setWidth * 0.5 || track.scrollLeft > setWidth * 1.5) {
      normalizing = true;
      const destination = track.scrollLeft < setWidth * 0.5
        ? track.scrollLeft + setWidth
        : track.scrollLeft - setWidth;

      setInstantScroll(destination);
      window.requestAnimationFrame(() => { normalizing = false; });
    }
  };

  track.dataset.infiniteCarousel = 'true';
  buildCopies();
  track.addEventListener('scroll', normalizePosition, { passive: true });
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
    if (!button) return;
    const section = button.closest('.bm-itineraries');
    const track = section && section.querySelector('.bm-itineraries__grid');
    const card = track && track.querySelector('.bm-itinerary-card');
    if (!track || !card) return;
    const direction = button.dataset.itineraryDirection === 'previous' ? -1 : 1;
    const step = card.getBoundingClientRect().width + 16;
    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  });
};

const initBlogProductCarousel = () => {
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-product-direction]');
    if (!button) return;
    const section = button.closest('.bm-products');
    const track = section && section.querySelector('.bm-products__track');
    const card = track && track.querySelector('.bm-product');
    if (!track || !card) return;
    const direction = button.dataset.productDirection === 'previous' ? -1 : 1;
    const step = card.getBoundingClientRect().width + 8;
    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  });
};

const initCategorySubcategories = () => {
  const navigation = document.querySelector('.category-subcategory-nav');
  if (!navigation) return;

  const triggers = Array.from(navigation.querySelectorAll('[data-subcategory-trigger]'));
  const panels = Array.from(navigation.querySelectorAll('[data-subcategory-panel]'));
  if (!triggers.length || !panels.length) return;

  navigation.addEventListener('click', event => {
    const trigger = event.target.closest('[data-subcategory-trigger]');
    if (!trigger) return;
    event.preventDefault();

    const wasExpanded = trigger.getAttribute('aria-expanded') === 'true';
    triggers.forEach(item => item.setAttribute('aria-expanded', 'false'));
    panels.forEach(panel => { panel.hidden = true; });

    if (wasExpanded) return;

    const panel = navigation.querySelector(`#${trigger.dataset.subcategoryPanel}`);
    if (!panel) return;
    trigger.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
};

import Imageloaded from './directives/imageloaded';
import Slides from './directives/slides';
import Gallery from './directives/gallery';
import Story from './directives/story';

Vue.config.productionTip = false;

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
