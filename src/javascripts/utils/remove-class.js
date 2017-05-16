const removeClass = function (element, classNames = []) {
  if (typeof classNames === 'string') {
    classNames = classNames.split(' ');
  }

  let className;

  for (className of classNames) {
    element.classList.remove(className);
  }

  return element;
};

export default removeClass;
