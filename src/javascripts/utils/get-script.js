const getScript = function (src, id, options) {
  options = options || {};

  const root = options.root || window.document;
  const tagName = 'script';
  const firstScript = root.getElementsByTagName(tagName)[0];

  if (root.getElementById(id)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const js = root.createElement(tagName);

    js.id = id;
    js.src = src;

    if (options.async) {
      js.async = true;
    }

    js.onload = resolve;
    js.onerror = reject;

    firstScript.parentNode.insertBefore(js, firstScript);
  });
};

export default getScript;
