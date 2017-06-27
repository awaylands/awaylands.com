const init = function(el) {
  const interval = el.dataset.interval || 5000;
  const slidesContainer = el.getElementsByClassName('slides__container')[0];
  const firstImage = slidesContainer.getElementsByTagName('img')[0];
  const caption = el.getElementsByClassName('slides__caption')[0];

  caption.innerHTML = firstImage.dataset.caption;
  caption.setAttribute('href', firstImage.dataset.link);

  const nextSlide = function() {
    const image = slidesContainer.getElementsByTagName('img')[0];
    const newImage = slidesContainer.getElementsByTagName('img')[1];

    if (newImage.dataset.caption) {
      caption.innerHTML = newImage.dataset.caption;
    } else {
      caption.innerHTML = '';
    }

    if (newImage.dataset.link) {
      caption.setAttribute('href', newImage.dataset.link);
    } else {
      caption.removeAttribute('href');
    }

    slidesContainer.appendChild(image);
  };

  const onLoad = function() {
    el.classList.add('is-loaded');

    setInterval(nextSlide, interval);
  };

  if (firstImage.complete) {
    onLoad();
  } else {
    firstImage.addEventListener('load', onLoad);
  }
};

export default {init};
