<template>
  <div class="listings" v-if="stories.length">
    <h1 class="listings__heading" v-text="heading"></h1>

    <ul class="listings__list">
      <li v-for="story in stories">
        <div class="listing">
          <a :href="story.path" class="listing">
            <div class="listing__image">
              <img :src="story.image" data-image v-imageloaded>

              <img :src="story.secondaryImage" v-if="story.secondaryImage" data-image v-imageloaded>
            </div>

            <h2 class="listing__heading" v-text="story.title"></h2>
            <div class="listing__content" v-if="story.tout.dek" v-text="story.tout.dek"></div>
          </a>
        </div>
      </li>
    </ul>

    <div v-if="hasAvailableItems" class="listings__load-more">
      <button class="button button--blue" @click="fetchItems" v-text="loadText"></button>
    </div>
  </div>
</template>

<script>
  import 'whatwg-fetch';
  import Imageloaded from '../directives/imageloaded';
  import {apiEndpoint, bearerToken} from '../utils/config';
  import {buildSrcset} from '../utils/format';

  var moment = require('moment');

  import {getImageUrl, route as createRoute} from 'takeshape-routing';
  import config from '../../../tsg.yml';

  const route = createRoute(config);

  export default {
    name: 'listings',
    props: ['paginationLength', 'id', 'subCategories', 'type', 'heading'],
    data() {
      return {
        total: 0,
        stories: [],
        variables: {},
        isLoaded: false,
        error: false
      };
    },
    computed: {
      isPopulated() {
        return this.stories.length > 0;
      },
      isEmpty() {
        return (this.stories.length === 0 && this.isLoaded);
      },
      hasAvailableItems() {
        return this.variables.from < this.total && this.total > 0;
      },
      loadText() {
        return this.isLoaded ? 'Load more' : 'Loading…';
      }
    },
    mounted() {
      this.fetchInitial();
    },
    methods: {
      async fetchInitial() {
        this.variables = {
          size: Number(this.paginationLength),
          from: 0
        };

        await this.fetchItems();
      },
      fetchItems() {
        this.isLoaded = false;

        const query = `
          query ($size: Int, $from: Int, $where: TSWhereStoryInput) {
            getStoryList(
              sort: [{field: "_enabledAt", order: "desc"}]
              from: $from
              size: $size
              where: $where
            ) {
              total
              items {
                _id
                _enabledAt
                _contentTypeName
                title
                tout {
                  image {
                    s3Key
                  }
                  secondaryImage {
                    s3Key
                  }
                  dek
                }
                category {
                  title
                }
              }
            }
          }
        `;


        const ids = this.type === 'continent' ? JSON.parse(this.subCategories).map(subCat => subCat._id) : [this.id];
        this.variables.where =  {
          location: {_id: {in:  ids}},
          _enabled: {eq: true}
        }

        fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`
          },
          body: JSON.stringify({query, variables: this.variables})
        })
          .then(res => res.json())
          .then(res => {
            const stories = res.data.getStoryList;

            for (const story of stories.items) {
              story.path = route(story._contentTypeName, story);
              story.date = moment(story._enabledAt).format('MMMM Do, YYYY');

              if (story.tout && story.tout.image) {
                story.image = getImageUrl(story.tout.image.s3Key);
                story.srcset = buildSrcset(story.tout.image, ['600','900','1200','1600'])
              } else {
                story.image = null;
              }

              if (story.tout && story.tout.secondaryImage) {
                story.secondaryImage = getImageUrl(story.tout.secondaryImage.s3Key);
                story.srcset = buildSrcset(story.tout.secondaryImage, ['600','900','1200','1600'])
              } else {
                story.secondaryImage = null;
              }
            }

            this.stories.push(...stories.items);
            this.stories.sort((a, b) => (a._enabledAt < b._enabledAt) ? 1 : -1);
            this.variables.from += Number(this.paginationLength);
            this.isLoaded = true;
          })
          .catch(error => {
            console.log(error);

            this.error = error;
          });
      }
    },
    directives: {
      Imageloaded
    }
  }
</script>
