import {LuminousGallery} from '../luminous';

const Shuffle = require('shufflejs');
const ImagesLoaded = require('imagesloaded');

const opts = {
  sourceAttribute: 'data-source'
};

const galleryOpts = {
  arrowNavigation: true
};

export default {
  name: 'gallery',
  bind(el) {
    el.imagesLoaded = new ImagesLoaded(el, () => {
      el.shuffle = new Shuffle(el, {
        itemSelector: '.masonry__item',
        sizer: '.masonry__sizer'
      });

      el.luminousGallery = new LuminousGallery(el.querySelectorAll('.still'), galleryOpts, opts);
    });
  }
};
