import { LuminousGallery }  from 'luminous-lightbox';

const Shuffle = require('shufflejs');

const opts = {
  sourceAttribute: 'data-source'
};

const galleryOpts = {
  arrowNavigation: true
};

const init = function (el) {
  new Shuffle(el, {
    itemSelector: '.masonry__item',
    sizer: '.masonry__sizer'
  });

  new LuminousGallery(el.querySelectorAll(".still"), galleryOpts, opts);
};

export default {init};
