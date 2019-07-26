import {luminousGallery} from '../luminous';

const imagesLoaded = require('imagesloaded');

const opts = {
  sourceAttribute: 'src'
};

const galleryOpts = {
  arrowNavigation: true
};

export default {
  name: 'story',
  bind(el) {
    imagesLoaded(el, () => {
      luminousGallery(el.querySelectorAll('figure img'), galleryOpts, opts);
    });
  }
};
