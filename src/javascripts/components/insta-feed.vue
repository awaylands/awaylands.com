<template>
 <div class="footer-insta-grid">
   <insta-post
     v-for="(post, index) of posts"
     :key="index"
     :post="post"
     @image-error="useFallbackPosts">
   </insta-post>
  </div>
</template>

<script>
  import InstaPost from './insta-post.vue';
  const FALLBACK_POSTS = [
    {
      caption: 'Sicily week one photo dump',
      media_url: '/assets/images/instagram-footer-sicily-photo-dump-full.jpg',
      permalink: 'https://www.instagram.com/p/DaWRaFQDCTI/',
    },
    {
      caption: 'Driving around Sicily',
      media_url: '/assets/images/instagram-footer-sicily-email-full.jpg',
      permalink: 'https://www.instagram.com/p/DaL4m70Dasu/',
    },
    {
      caption: 'Wilson\u2019s Creek, New Zealand',
      media_url: '/assets/images/instagram-footer-new-zealand-full.jpg',
      permalink: 'https://www.instagram.com/p/DZd33rkmu8j/',
    },
    {
      caption: 'A swim in the Mediterranean in the South of France',
      media_url: '/assets/images/instagram-footer-south-of-france-full.jpg',
      permalink: 'https://www.instagram.com/p/DZOfBBuFPtV/',
    },
    {
      caption: 'Snow monkeys in Japan',
      media_url: '/assets/images/instagram-footer-snow-monkeys-full.jpg',
      permalink: 'https://www.instagram.com/p/DZJj0gOFIWL/',
    },
    {
      caption: 'Amy and her Pomeranian',
      media_url: '/assets/images/instagram-footer-pomeranian-full.jpg',
      permalink: 'https://www.instagram.com/p/DZDbvfymNZ1/',
    },
  ];

  export default {
    name: 'InstaFeed',
    components: { InstaPost },
    data() {
      return {
        posts: FALLBACK_POSTS.slice(),
      };
    },
    methods: {
      useFallbackPosts() {
        this.posts = FALLBACK_POSTS.slice();
      },
    },
  };
</script>
