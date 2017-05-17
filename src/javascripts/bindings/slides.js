const init = function(el) {
  const interval = el.dataset.interval || 5000;
  const slidesContainer = el.getElementsByClassName('slides__container')[0];
  const firstImage = slidesContainer.getElementsByTagName('img')[0];
  const caption = el.getElementsByClassName('slides__caption')[0];

  caption.innerHTML = firstImage.dataset.caption;

  const onLoad = function() {
    el.classList.add('is-loaded');
  };

  if (firstImage.complete) {
    onLoad();
  } else {
    firstImage.addEventListener('load', onLoad);
  }

  const nextSlide = function() {
    slidesContainer.appendChild(slidesContainer.getElementsByTagName('img')[0]);

    caption.innerHTML = slidesContainer.getElementsByTagName('img')[0].dataset.caption;
  };

  setInterval(nextSlide, interval);
};

export default {init};
