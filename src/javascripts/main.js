import objectFitImages from 'object-fit-images';

import Vue from 'vue';

import PageHeader from './components/header';
import Imageloaded from './directives/imageloaded';

Vue.config.productionTip = false;

export const eventBus = new Vue();

export default new Vue({
  el: '#app',
  mounted() {
    objectFitImages();
  },
  methods: {},
  components: {
    pageheader: PageHeader
  },
  directives: {
    Imageloaded
  }
});
