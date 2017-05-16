import ko from 'knockout';
import Base from './base';

const ESC_KEYCODE = 27;

class Header extends Base {
  constructor() {
    super();

    this.isSticky = ko.observable(false);
    this.isOpen = ko.observable(false);

    document.onkeydown = this.captureEscape.bind(this);

    window.addEventListener("scroll", this.onScroll.bind(this));

    this.onScroll();
  }

  toggleOpen() {
    this.isOpen(!this.isOpen());
  }

  close() {
    this.isOpen(false);
  }

  onScroll() {
    const maxOffset = 20;

    if (!this.isSticky() && window.pageYOffset >= maxOffset) {
      this.isSticky(true);
    } else if (this.isSticky() && window.pageYOffset < maxOffset) {
      this.isSticky(false);
    }
  }

  captureEscape(event) {
    if (this.isOpen() && event.keyCode === ESC_KEYCODE) {
      this.close();
    }
  }

  destroy() {
    super.destroy();
  }
}

export default Header;
