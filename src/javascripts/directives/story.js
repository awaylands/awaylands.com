import {LuminousGallery} from '../luminous';

const ImagesLoaded = require('imagesloaded');

const opts = {
  sourceAttribute: 'src'
};

const galleryOpts = {
  arrowNavigation: true
};

export default {
  name: 'story',
  bind(el) {
    new ImagesLoaded(el, () => {
      new LuminousGallery(el.querySelectorAll('figure img'), galleryOpts, opts);
    });
  }
};
