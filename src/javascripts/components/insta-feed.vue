<template>
 <div class="footer-insta-grid">
   <insta-post v-for="(post, index) of posts" :key="index" :post="post"></insta-post>
  </div>
</template>

<script>
  import axios from 'axios';
  import InstaPost from './insta-post.vue';

  const INSTA_POSTS = 'INSTA_POSTS';
  const INSTA_LAST_UPDATE_TIME = 'INSTA_LAST_UPDATE_TIME';

  const AMY_ACCESS_TOKEN = 'IGAGI5QHmV6vZABZAFlTdmNLV2NqQzR0c0hQNnExVFQyRktERWlHbDdnTzZA4aWxkc3Nxb0dTRWVlZA25DU20xOTdaSklSQmEwUm05TG91MUdiSDExS1RwcjJRTjNFSlE0S1dTVkhHclpTc2FkZAzNuUDc3QlVEdnplM2dpYTEyX2pCSQZDZD';

  const UPDATE_INSTA_SECOND_TIME = 3600; // Every 1 hour

  export default {
    name: 'InstaFeed',
    components: { InstaPost },
    data() {
      return {
        posts: [],
      };
    },
    mounted() {
      this.getPosts();
    },
    methods: {
      getPosts() {
        const lastUpdateTime = localStorage.getItem(INSTA_LAST_UPDATE_TIME) || null;

        if (lastUpdateTime === null || this.canRequest(lastUpdateTime)) {
          this.getPostsFromApi();
        } else {
          this.getPostsFromLocalStorage();
        }
      },
      canRequest(lastUpdateTime) {
        const now = new Date();
        const storageDate = new Date(lastUpdateTime);
        const dif = now.getTime() - storageDate.getTime();
        const secondsBetweenDates = Math.trunc(dif / 1000);

        return secondsBetweenDates >= UPDATE_INSTA_SECOND_TIME;
      },
      getPostsFromLocalStorage() {
        this.posts = JSON.parse(localStorage.getItem(INSTA_POSTS)) || [];
      },
      getPostsFromApi() {
        axios.get(`https://graph.instagram.com/me/media?fields=id,caption,media_url,permalink,timestamp,media_type&access_token=${AMY_ACCESS_TOKEN}`)
          .then((res) => {
            this.posts = res.data.data
              .filter(post => post.media_type !== 'VIDEO')
              .slice(0, 6);

            localStorage.setItem(INSTA_POSTS, JSON.stringify(this.posts));
            localStorage.setItem(INSTA_LAST_UPDATE_TIME, new Date());
          })
          .catch((err) => {
            console.error(err);

            if (this.posts.length === 0) {
              this.getPostsFromLocalStorage();
            }
          });
      },
    },
  };
</script>