const getDescendant = function (element, className) {
  const children = element.childNodes;

  for (var i = 0; i < children.length; i++) {
    if (children[i].className &&
      children[i].className.split(' ').indexOf(className) >= 0)
    {
      return children[i];
    }
  }

  for (var i = 0; i < children.length; i++) {
    var match = getDescendant(children[i], className);
    if (match !== null) {
      return match;
    }
  }

  return null;
};

export default getDescendant;
