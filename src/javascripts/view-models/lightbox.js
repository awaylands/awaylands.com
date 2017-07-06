import ko from 'knockout';
import Base from './base';
import { LuminousGallery }  from 'luminous-lightbox';

const Shuffle = require('shufflejs');

class Lightbox extends Base {
  constructor() {
    super();

    var opts = {
      sourceAttribute: 'data-source'
    };

    var galleryOpts = {
      arrowNavigation: true
    };

    window.addEventListener("load", function(e) {
      new LuminousGallery(document.querySelectorAll(".still"), galleryOpts, opts);

      new Shuffle(document.getElementById('masonry'), {
        itemSelector: '.masonry__item',
        sizer: '.masonry__sizer'
      });
    });
  }

  destroy() {
    super.destroy();
  }
}

export default Lightbox;
