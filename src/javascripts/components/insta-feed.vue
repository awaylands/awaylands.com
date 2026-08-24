<template>
 <div class="footer-insta-grid">
   <insta-post v-for="(post, index) of posts" :key="index" :post="post"></insta-post>
  </div>
</template>

<script>
  import 'whatwg-fetch';
  import InstaPost from './insta-post.vue';

  const INSTA_POSTS = 'INSTA_POSTS';
  const INSTA_LAST_UPDATE_TIME = 'INSTA_LAST_UPDATE_TIME';

  const AMY_ACCESS_TOKEN = 'IGAGI5QHmV6vZABZAFlTdmNLV2NqQzR0c0hQNnExVFQyRktERWlHbDdnTzZA4aWxkc3Nxb0dTRWVlZA25DU20xOTdaSklSQmEwUm05TG91MUdiSDExS1RwcjJRTjNFSlE0S1dTVkhHclpTc2FkZAzNuUDc3QlVEdnplM2dpYTEyX2pCSQZDZD';

  const UPDATE_INSTA_SECOND_TIME = 3600; // Every 1 hour
  const INSTA_POST_LIMIT = 6;

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
        const cachedPosts = JSON.parse(localStorage.getItem(INSTA_POSTS)) || [];

        if (lastUpdateTime === null || this.canRequest(lastUpdateTime) || cachedPosts.length < INSTA_POST_LIMIT) {
          this.getPostsFromApi();
        } else {
          this.posts = cachedPosts.slice(0, INSTA_POST_LIMIT);
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
        this.posts = (JSON.parse(localStorage.getItem(INSTA_POSTS)) || []).slice(0, INSTA_POST_LIMIT);
      },
      getPostsFromApi() {
        fetch(`https://graph.instagram.com/me/media?fields=id,caption,media_url,permalink,timestamp,media_type&access_token=${AMY_ACCESS_TOKEN}`)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Instagram request failed with status ${response.status}`);
            }

            return response.json();
          })
          .then((data) => {
            this.posts = data.data
              .filter(post => post.media_type !== 'VIDEO')
              .slice(0, INSTA_POST_LIMIT);

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
