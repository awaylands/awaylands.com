import Imageloaded from '../directives/imageloaded';
import {Instafeed} from 'instafeed';

export default {
  name: 'instagram',
  data() {
    return {};
  },
  mounted() {
    const amyFeed = new Instafeed({
      get: 'user',
      userId: '1050599',
      accessToken: '1050599.1677ed0.1704518e6a6047718b118a2d6d7fd08c',
      target: '.instafeed-row'
    });

    amyFeed.run();
  },
  methods: {},
  directives: {
    imageloaded: Imageloaded
  }
};
