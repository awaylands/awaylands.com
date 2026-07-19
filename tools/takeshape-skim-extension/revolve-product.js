(function () {
  'use strict';

  function sendProduct() {
    const product = document.querySelector('#js-affiliate-widget-single .aff-widget-single__product');
    const link = product && product.querySelector('a[href]');
    const image = product && product.querySelector('img');
    const name = product && product.querySelector('.product-name');
    const brand = product && product.querySelector('.product-brand');
    const price = product && product.querySelector('.price__retail, .price');

    if (!link || !image || !name) {
      return false;
    }

    window.parent.postMessage({
      type: 'awaylands-revolve-product',
      frameUrl: window.location.href,
      product: {
        url: link.href,
        image: image.currentSrc || image.src,
        name: (name.textContent || '').trim(),
        brand: (brand && brand.textContent || '').trim(),
        price: (price && price.textContent || '').trim()
      }
    }, '*');
    return true;
  }

  if (!sendProduct()) {
    const observer = new MutationObserver(() => {
      if (sendProduct()) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 15000);
  }
}());
