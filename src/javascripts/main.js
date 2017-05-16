import 'core-js/es6';
import svg4everybody from 'svg4everybody';
import 'knockout-postbox';
import objectFitImages from 'object-fit-images';
import ready from 'raf-ready';

import App from './app';

window.app = new App();

ready(() => {
  objectFitImages();
  svg4everybody();
  window.app.start();
});
