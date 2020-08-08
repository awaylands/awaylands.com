<template>
  <div>
    <div class="insta-feed__post">
      <a :href="post.link" target="_blank" rel="noopener noreferrer">
        <img :src="img"
             :alt="caption"
             @load="imgLoaded = true">
      </a>
    </div>
  </div>
</template>

<script>
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
      };
    },
    computed: {
      img() {
        return this.post.images.standard_resolution.url;
      },
      caption() {
        return this.post.caption.text;
      },
    },
  };
</script>

