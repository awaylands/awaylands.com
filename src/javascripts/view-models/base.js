import objectFitImages from 'object-fit-images';

class Base {
  afterRender(renderedElements) {
    if (renderedElements && renderedElements.length) {
      const wrapper = renderedElements[0].parentNode;
      if (wrapper) {
        objectFitImages(wrapper);
      }
    }
  }

  dispose() {
    // Do nothing
  }
}

export default Base;
