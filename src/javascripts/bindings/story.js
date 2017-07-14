import { LuminousGallery }  from 'luminous-lightbox';

const ImagesLoaded = require('imagesloaded');

const opts = {
  sourceAttribute: 'src'
};

const galleryOpts = {
  arrowNavigation: true
};

const init = function (el) {
  new ImagesLoaded(el, function() {
    new LuminousGallery(el.querySelectorAll("figure img"), galleryOpts, opts);
  });
};


export default {init};
