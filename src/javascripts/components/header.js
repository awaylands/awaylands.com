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

    this.onScroll();
  },
  methods: {
    toggleOpen() {
      this.isOpen = !this.isOpen;
    },
    close() {
      this.isOpen = false;
    },
    contactScroll() {
      const footer = document.getElementById('footer').offsetTop;

      scrollTo(footer, null, 700);
    },
    captureEscape(event) {
      if (this.isOpen()) {
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
      if (!this.isSticky && window.pageYOffset >= this.maxOffset) {
        this.isSticky = true;
      } else if (this.isSticky && window.pageYOffset < this.maxOffset) {
        this.isSticky = false;
      }
    },
    checkWindowSize() {
      if (window.innerWidth >= 1200 && this.isOpen) {
        this.toggleOpen();
      }
    }
  }
};
