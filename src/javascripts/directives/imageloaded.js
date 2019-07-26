export default {
  name: 'imageloaded',
  bind(el) {
    const isImage = el.tagName === 'IMG' || el.tagName === 'img';

    const onLoad = function () {
      el.classList.remove('will-load');
      el.classList.add('is-loaded');
    };

    if (isImage) {
      el.classList.add('will-load');

      if (el.complete) {
        onLoad();
      } else {
        el.addEventListener('load', onLoad);
      }
    }
  }
};
