import Imageloaded from '../directives/imageloaded';

const Instafeed = require('instafeed.js');

export default {
  name: 'instagram',
  data() {
    return {};
  },
  mounted() {
    let amyItems;

    const amyFeed = new Instafeed({
      get: 'user',
      userId: '1050599',
      accessToken: '1050599.1677ed0.1704518e6a6047718b118a2d6d7fd08c',
      limit: 6,
      resolution: 'standard_resolution',
      sortBy: 'most-recent',
      success(items) {
        amyItems = items;

        return items;
      }
    });

    console.log(amyItems, 'amyitems');
    console.log(amyFeed, 'amyfeed');

    amyFeed.run();
  },
  methods: {},
  directives: {
    imageloaded: Imageloaded
  }
};
