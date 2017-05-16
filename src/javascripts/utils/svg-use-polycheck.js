let polycheck = null;

export default function () {
  if (polycheck !== null) {
    return Promise.resolve(polycheck);
  }

  let retries = 3;
  let svg;
  let use;
  let body;
  let id;

  return new Promise(resolve => {
      function check(e) {
    polycheck = use.getBoundingClientRect().width != 0;

    if (polycheck) {
      return resolve(true);
    }

    if (e || !--retries) {
      body.removeChild(svg);
      clearInterval(id);
      return resolve(false);
    }
  }

  try {
    const url = URL.createObjectURL(
      new Blob([
        '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="1" height="1" id="x"/>' +
        '</svg>'
      ], {type: 'image/svg+xml'})
    );

    body = document.body;
    body.insertAdjacentHTML('beforeend',
      '<svg style="position:absolute;visibility:hidden">' +
      '<use xlink:href="' + url + '#x"/>' +
      '</svg>'
    );

    svg = body.lastChild;
    use = svg.firstChild;
    id = setInterval(check, 50);

    use.addEventListener('load', check);
  } catch (e) {
    resolve(false);
  }
});
}
