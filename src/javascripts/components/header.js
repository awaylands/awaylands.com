import scrollTo from '../utils/scroll-to';

const ESC_KEYCODE = 27;

export default {
  name: 'pageheader',
  data() {
    return {
      isSticky: false,
      isOpen: false,
      maxOffset: 20
    };
  },
  mounted() {
    window.addEventListener('scroll', this.onScroll.bind(this));
    window.addEventListener('resize', this.checkWindowSize.bind(this));

    document.onkeydown = this.captureEscape.bind(this);

    this.onScroll();
  },
  methods: {
    toggleOpen() {
      this.isOpen = !this.isOpen;
      this.syncPageLock();
    },
    close() {
      this.isOpen = false;
      this.syncPageLock();
    },
    syncPageLock() {
      document.body.classList.toggle('is-mobile-nav-open', this.isOpen);
    },
    contactScroll() {
      const footer = document.getElementById('footer').offsetTop;

      this.close();
      scrollTo(footer, null, 700);
    },
    captureEscape(event) {
      if (this.isOpen) {
        if (event.key === ESC_KEYCODE) {
          this.close();
        } else if (event.keyIdentifier === ESC_KEYCODE) {
          this.close();
        } else if (event.keyCode === ESC_KEYCODE) {
          this.close();
        }
      }
    },
    onScroll() {
      let maxOffset = this.maxOffset;

      if (window.location.pathname === '/') {
        maxOffset = window.innerHeight - 20;
      }

      if (document.body.classList.contains('body--blog-magazine')) {
        const heroTitle = document.querySelector('.bm-hero__copy h1');

        if (heroTitle) {
          const headerHeight = this.$el ? this.$el.getBoundingClientRect().height : 0;
          maxOffset = heroTitle.getBoundingClientRect().top + window.pageYOffset - headerHeight;
        }
      }

      if (document.body.classList.contains('body--blog-category')) {
        const categoryLabel = document.querySelector('.category-magazine-hero .category-kicker');

        if (categoryLabel) {
          const headerHeight = this.$el ? this.$el.getBoundingClientRect().height : 0;
          maxOffset = categoryLabel.getBoundingClientRect().top + window.pageYOffset - headerHeight;
        }
      }

      if (!this.isSticky && window.pageYOffset >= maxOffset) {
        this.isSticky = true;
      } else if (this.isSticky && window.pageYOffset < maxOffset) {
        this.isSticky = false;
      }
    },
    checkWindowSize() {
      if (window.innerWidth >= 1200 && this.isOpen) {
        this.close();
      }
    }
  }
};
