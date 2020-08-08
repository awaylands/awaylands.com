import objectFitImages from 'object-fit-images';

import Vue from 'vue';

import PageHeader from './components/header';
import InstaFeed from './components/insta-feed.vue';
import Listings from './components/listings.vue';

import Imageloaded from './directives/imageloaded';
import Slides from './directives/slides';
import Gallery from './directives/gallery';
import Story from './directives/story';

Vue.config.productionTip = false;

export const eventBus = new Vue();

export default new Vue({
  el: '#app',
  mounted() {
    objectFitImages();
  },
  methods: {},
  components: {
    pageheader: PageHeader,
    instafeed: InstaFeed,
    listings: Listings
  },
  directives: {
    Imageloaded,
    Slides,
    Gallery,
    Story
  }
});
