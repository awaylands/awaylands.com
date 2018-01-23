import {LuminousGallery} from '../luminous';

const ImagesLoaded = require('imagesloaded');

const opts = {
  sourceAttribute: 'src'
};

const galleryOpts = {
  arrowNavigation: true
};

const init = function (el) {
  new ImagesLoaded(el, () => {
    new LuminousGallery(el.querySelectorAll('figure img'), galleryOpts, opts);
  });
};

export default {init};
