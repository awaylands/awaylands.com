'use strict';

let plugins = [
  require('postcss-custom-media'),
  require('postcss-media-minmax'),
  require('autoprefixer')({
    overrideBrowserslist: '> 0.5%, last 2 versions, not dead'
  }),
  require('lost')
];

if (process.env.NODE_ENV === 'production') {
  plugins = plugins.concat([
    require('postcss-urlrev'),
    require('cssnano')
  ]);
}

module.exports =  {
  plugins
};
