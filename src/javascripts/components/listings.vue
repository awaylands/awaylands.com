<template>
  <div class="listings" v-if="stories.length">
    <ul class="listings__list">
      <li v-for="story in stories">
        <div class="listing">
          <a :href="story.path" class="listing">
            <header class="listing__header">
              <div class="listing__rubric">
                <span v-if="story.date" v-text="story.date"></span>
                <span v-for="category in story.category" v-text="category.title"></span>
              </div>

              <h2 class="listing__heading" v-text="story.title"></h2>
            </header>

            <div class="listing__image">
              <img :src="story.image" :srcet="story.srcset" data-image v-imageloaded>
            </div>

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
          from: 0,
          filter: {
            bool: {
              must: {
                match: {
                  _enabled: true
                }
              },
              should: []
            }
          }
        };

        await this.fetchItems();
      },
      fetchItems() {
        console.log('fetching!');
        this.isLoaded = false;

        let query;

        if (this.id) {
          this.variables.id = this.id;
        }

        switch (this.type) {
          case 'continent':
            query = `
              query($size: Int, $from: Int, $filter: JSON) {
                getLocationList(filter: $filter) {
                  total
                  items {
                    _id
                    storySet(sort: [{field: "_enabledAt", order: "desc"}], from: $from, size: $size) {
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
                          dek
                        }
                        category {
                          title
                        }
                      }
                    }
                  }
                }
              }
            `;

            for (const subCat of JSON.parse(this.subCategories)) {
              const rule = { match: {_id: subCat._id}};
              this.variables.filter.bool.should.push(rule);
            }

            break;
          default:
            query = `
              query($id: ID!, $size: Int, $from: Int, $filter: JSON) {
                getLocation(_id: $id) {
                  storySet(sort: [{field: "_enabledAt", order: "desc"}], from: $from, size: $size, filter: $filter) {
                    total
                    items {
                      _enabledAt
                      _id
                      _contentTypeName
                      title
                      tout {
                        image {
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
              }
            `;
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
            let stories = [];

            switch (this.type) {
              case 'continent':
                stories.total = 0;
                stories.items = [];

                let locations = res.data.getLocationList.items;

                for (const location of locations) {
                  stories.items.push(...location.storySet.items);

                  if (location.storySet.total > stories.total) {
                    stories.total = location.storySet.total;
                  }
                }

                // Removes duplicate story elements
                stories.items = stories.items.filter((story, index, self) =>
                  index === self.findIndex((i) => (
                    i._id === story._id
                  ))
                );

                if (!this.total) {
                  this.total = stories.total;
                }

                break;
              default:
                stories = res.data.getLocation.storySet;

                if (!this.total) {
                  this.total = stories.total;
                }
            }

            for (const story of stories.items) {
              story.path = route(story._contentTypeName, story);
              story.date = moment(story._enabledAt).format('MMMM Do, YYYY');

              if (story.tout && story.tout.image) {
                story.image = getImageUrl(story.tout.image.s3Key);
                story.srcset = buildSrcset(story.tout.image, ['600','900','1200','1600'])
              } else {
                story.image = null;
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
