<template>
  <div class="insta-feed">
    <insta-post v-for="(post, index) of posts" :key="index" :post="post"/>
  </div>
</template>

<script>
  import axios from 'axios';
  import InstaPost from './insta-post.vue';

  const INSTA_POSTS = 'INSTA_POSTS';
  const INSTA_LAST_UPDATE_TIME = 'INSTA_LAST_UPDATE_TIME';

  const AMY_USER_ID = '1050599';
  const AMY_ACCESS_TOKEN = '1050599.1677ed0.1704518e6a6047718b118a2d6d7fd08c';

  const BRANDON_USER_ID = '55533805';
  const BRANDON_ACCESS_TOKEN = '55533805.1677ed0.fe23c854742a4085b3377669fc5ce87e';

  const UPDATE_INSTA_SECOND_TIME = 120; // Every 2 minutes

  export default {
    name: 'InstaFeed',
    components: { InstaPost },
    data() {
      return {
        posts: [],
        amyPosts: {},
        brandonPosts: {},
        getPostInterval: null,
      };
    },
    mounted() {
      this.getPosts();
      this.getPostInterval = setInterval(() => {
        this.getPosts();
      }, 5000);
    },
    beforeDestroy() {
      if (this.getPostInterval) {
        clearInterval(this.getPostInterval);
      }
    },
    methods: {
      getPosts() {
        const lastUpdateTime = localStorage.getItem(INSTA_LAST_UPDATE_TIME) || null;

        if (lastUpdateTime === null || this.canRequest(lastUpdateTime)) {
          // Get from API
          this.getPostsFromApi();
        } else {
          // Get from LocalStorage
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

        console.log('local storage', this.posts);
      },
      getPostsFromApi() {
        axios.get(`https://api.instagram.com/v1/users/${BRANDON_USER_ID}/media/recent?access_token=${BRANDON_ACCESS_TOKEN}&count=3`)
          .then((res) => {
            this.brandonPosts = res.data.data;

            console.log(this.brandonPosts, 'this brandonPosts');

            axios.get(`https://api.instagram.com/v1/users/${AMY_USER_ID}/media/recent?access_token=${AMY_ACCESS_TOKEN}&count=3`)
              .then((res) => {
                this.amyPosts = res.data.data;

                console.log(this.amyPosts, 'this amyposts');

                this.posts = this.brandonPosts.concat(this.amyPosts);
                this.posts.sort((a,b) => (a.created_time > b.created_time) ? -1 : 1);

                console.log(this.posts, 'this posts');

                localStorage.setItem(INSTA_POSTS, JSON.stringify(this.posts));
              }).catch((err) => {
                console.error(err);

                if (this.posts.length === 0) {
                  this.getPostsFromLocalStorage();
                }
              }
            );
          }).catch((err) => {
            console.error(err);

            if (this.posts.length === 0) {
              this.getPostsFromLocalStorage();
            }
          }
        );

        localStorage.setItem(INSTA_LAST_UPDATE_TIME, new Date());
      },
    },
  };
</script>
