import {luminousGallery} from '../luminous';

const shuffle = require('shufflejs');
const imagesLoaded = require('imagesloaded');

const opts = {
  sourceAttribute: 'data-source'
};

const galleryOpts = {
  arrowNavigation: true
};

export default {
  name: 'gallery',
  bind(el) {
    imagesLoaded(el, () => {
      shuffle(el, {
        itemSelector: '.masonry__item',
        sizer: '.masonry__sizer'
      });

      luminousGallery(el.querySelectorAll('.still'), galleryOpts, opts);
    });
  }
};
