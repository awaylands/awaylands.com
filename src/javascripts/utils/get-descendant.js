const getDescendant = function (element, className) {
  const children = element.childNodes;

  for (let index = 0; index < children.length; index += 1) {
    if (children[index].className &&
      children[index].className.split(' ').indexOf(className) >= 0) {
      return children[index];
    }
  }

  for (let index = 0; index < children.length; index += 1) {
    const match = getDescendant(children[index], className);
    if (match !== null) {
      return match;
    }
  }

  return null;
};

export default getDescendant;
