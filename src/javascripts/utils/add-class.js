const addClass = function (element, classNames = []) {
  if (typeof classNames === 'string') {
    classNames = classNames.split(' ');
  }

  let className;

  for (className of classNames) {
    element.classList.add(className);
  }

  return element;
};

export default addClass;
