const path = require('path');
const webpack = require('webpack');
const {VueLoaderPlugin} = require('vue-loader');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const {WebpackManifestPlugin} = require('webpack-manifest-plugin');
const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  mode: isProd ? 'production' : 'development',
  devtool: isProd ? false : 'source-map',
  entry: {
    'javascripts/main': './src/javascripts/main.js',
    'stylesheets/main': './src/stylesheets/main.scss'
  },
  output: {
    path: path.join(__dirname, 'build/assets'),
    filename: isProd ? '[name].[contenthash].js' : '[name].js',
    publicPath: '/assets/'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules|vendor/,
        loader: 'babel-loader'
      },
      {
        test: /\.s?css$/,
        use: [
          isProd ? MiniCssExtractPlugin.loader : 'style-loader',
          {
            loader: 'css-loader',
            options: {
              url: {
                filter: url => !url.startsWith('/assets/')
              }
            }
          },
          'postcss-loader',
          {
            loader: 'sass-loader',
            options: {
              sassOptions: {
                silenceDeprecations: ['import', 'global-builtin']
              }
            }
          }
        ]
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.jpe?g$|\.gif$|\.png$|\.svg$|\.woff2?$|\.ttf$|\.wav$|\.mp3$/,
        type: 'asset/resource',
        generator: {
          filename: '[path][name].[contenthash:5][ext]'
        }
      },
      {
        test: /\.ya?ml$/,
        use: {
          loader: 'yaml-loader'
        }
      }
    ]
  },
  resolve: {
    alias: {
      vue$: '@vue/compat/dist/vue.esm-bundler.js'
    },
    modules: ['node_modules', 'src'],
    extensions: ['.js', '.json', '.vue']
  },
  plugins: [
    new VueLoaderPlugin(),
    new webpack.DefinePlugin({
      __VUE_OPTIONS_API__: JSON.stringify(true),
      __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false)
    }),
    new WebpackManifestPlugin({fileName: 'manifest.json', publicPath: ''}),
    new MiniCssExtractPlugin({filename: isProd ? '[name].[contenthash].css' : '[name].css'})
  ],
  performance: {
    hints: false
  }
};
