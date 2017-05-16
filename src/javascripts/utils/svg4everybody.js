const requests = {};

function embed(svg, target) {
  // if the target exists
  if (target) {
    // create a document fragment to hold the contents of the target
    const fragment = document.createDocumentFragment();

    // cache the closest matching viewBox
    const viewBox = !svg.getAttribute('viewBox') && target.getAttribute('viewBox');

    // conditionally set the viewBox on the svg
    if (viewBox) {
      svg.setAttribute('viewBox', viewBox);
    }

    // clone the target
    const clone = target.cloneNode(true);

    // copy the contents of the clone into the fragment
    while (clone.childNodes.length) {
      fragment.appendChild(clone.firstChild);
    }

    // append the fragment into the svg
    svg.appendChild(fragment);
  }
}

function loadreadystatechange(xhr) {
  // listen to changes in the request
  xhr.onreadystatechange = function () {
    // if the request is ready
    if (xhr.readyState === 4) {
      // get the cached html document
      let cachedDocument = xhr._cachedDocument;

      // ensure the cached html document based on the xhr response
      if (!cachedDocument) {
        cachedDocument = xhr._cachedDocument = document.implementation.createHTMLDocument('');

        cachedDocument.body.innerHTML = xhr.responseText;

        xhr._cachedTarget = {};
      }

      // clear the xhr embeds list and embed each item
      xhr._embeds.splice(0).map(item => {
        // get the cached target
        let target = xhr._cachedTarget[item.id];

      // ensure the cached target
      if (!target) {
        target = xhr._cachedTarget[item.id] = cachedDocument.getElementById(item.id);
      }

      // embed the target into the svg
      embed(item.svg, target);

      return target;
    });
    }
  };

  // test the ready state change immediately
  xhr.onreadystatechange();
}

export function svgEmbed(svg) {
  const uses = svg.getElementsByTagName('use');

  if (!uses || !uses.length) {
    return;
  }

  const use = uses[0];
  const src = use.getAttribute('xlink:href');

  // remove the <use> element
  svg.removeChild(use);

  // parse the src and get the url and id
  const srcSplit = src.split('#');
  const url = srcSplit.shift();
  const id = srcSplit.join('#');

  // if the link is external
  if (url.length) {
    // get the cached xhr request
    let xhr = requests[url];

    // ensure the xhr request exists
    if (!xhr) {
      xhr = requests[url] = new XMLHttpRequest();

      xhr.open('GET', url);

      xhr.send();

      xhr._embeds = [];
    }

    // add the svg and id as an item to the xhr embeds list
    xhr._embeds.push({
      svg,
      id
    });

    // prepare the xhr ready state change event
    loadreadystatechange(xhr);
  }
}
