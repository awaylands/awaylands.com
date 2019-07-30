<template>
  <div>
    <div class="insta-post">
      <img :src="imgThumb" alt="Image Instagram"
           @click="fullscreenClicked = true"
           @load="imgLoaded = true">
      <!--<a :href="post.link" target="_blank"></a>-->
      <div v-if="imgLoaded" class="timeago">{{ timeago }}</div>
    </div>
    <div class="post-fullscreen" v-if="fullscreenClicked">
      <div class="overlay" @click="fullscreenClicked = false"></div>
      <div class="img">
        <div class="close" @click="fullscreenClicked = false">×</div>
        <img :src="imgBig" alt="Image Fullscreen Instagram">
      </div>
    </div>
  </div>
</template>

<script>
  import moment from 'moment';

  export default {
    name: 'InstaPost',
    props: {
      post: {
        type: Object,
        default: null,
      },
    },
    data() {
      return {
        imgLoaded: false,
        fullscreenClicked: false,
        timeago: '',
        timeagoInterval: null,
      };
    },
    created() {
      this.changeTimeago();
    },
    mounted() {
      this.timeagoInterval = setInterval(this.changeTimeago, 30000);
    },
    beforeDestroy() {
      if (this.timeagoInterval) {
        clearInterval(this.timeagoInterval);
      }
    },
    computed: {
      img() {
        return this.post.images.low_resolution.url;
      },
      imgThumb() {
        return this.post.images.thumbnail.url;
      },
      imgBig() {
        return this.post.images.standard_resolution.url;
      },
      createdAt() {
        return new Date(this.post.created_time * 1000);
      },
    },
    methods: {
      changeTimeago() {
        this.timeago = moment(this.createdAt).fromNow();
      },
    },
  };
</script>

<style lang="scss" scoped>
  .insta-post {
    width: fit-content;
    margin: 10px;
    position: relative;

    img {
      cursor: pointer;
    }

    .timeago {
      background: rgba(128, 128, 128, 0.75);
      color: #ffffff;
      width: 120px;
      font-weight: 600;
      position: absolute;
      bottom: 4px;
      right: 0;
      padding: 10px;
      visibility: hidden;
      opacity: 0;
      transition: visibility 0.2s, opacity 0.2s linear;
    }

    &:hover {
      .timeago {
        visibility: visible;
        opacity: 1;
      }
    }
  }

  .post-fullscreen {
    .img {
      z-index: 500;
      position: fixed;
      top: calc(50vh - (640px / 2));
      left: calc(50vw - (640px / 2));

      &:hover {
        .close {
          visibility: visible;
          opacity: 1;
        }
      }
    }

    .overlay {
      z-index: 499;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(73, 73, 73, 0.66);
    }

    .close {
      position: absolute;
      top: 0;
      right: 8px;
      font-size: 35px;
      font-weight: 700;
      color: white;
      text-shadow: 1px 2px rgba(73, 73, 73, 0.66);
      visibility: hidden;
      opacity: 0;
      transition: visibility 0.2s, opacity 0.2s linear;

      &:hover {
        cursor: pointer;
      }
    }
  }
</style>
