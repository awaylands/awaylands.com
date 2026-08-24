<template>
  <div class="insta-feed__post">
    <a :href="post.permalink" target="_blank" rel="noopener noreferrer">
      <img
        :src="post.media_url"
        :alt="caption"
        loading="lazy"
        decoding="async"
        @load="imgLoaded = true"
        @error="$emit('image-error')">
    </a>
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
    caption() {
      return this.post.caption || 'Instagram post from Away Lands';
    },
  },
};
</script>
