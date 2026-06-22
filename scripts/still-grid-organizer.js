const http = require('http');
const fs = require('fs');
const url = require('url');
const axios = require('axios');
const {getImageUrl} = require('takeshape-routing');

const PORT = process.env.PORT || 5055;
const HOST = '127.0.0.1';
const graphqlConfig = JSON.parse(fs.readFileSync('.graphqlconfig', 'utf8'));
const endpoint = graphqlConfig.extensions.endpoints.TakeShape;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function logRequest(req, parsed) {
  console.log(new Date().toISOString() + ' ' + req.method + ' ' + parsed.pathname);
}

function sendHtml(res, html) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(html);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

async function gql(query, variables) {
  const response = await axios({
    method: 'POST',
    url: endpoint.url,
    headers: endpoint.headers,
    data: {query, variables}
  });

  if (response.data.errors) {
    throw new Error(JSON.stringify(response.data.errors, null, 2));
  }

  return response.data.data;
}

function formatImage(still, index) {
  const asset = still && still.image;

  if (!asset || !asset._id || !asset.path) {
    return null;
  }

  return {
    id: asset._id,
    path: asset.path,
    url: getImageUrl(asset.path, {w: 500, auto: 'compress,format'}),
    index
  };
}

function formatImages(stills) {
  return (stills || [])
    .map(formatImage)
    .filter(Boolean);
}

async function getGalleries() {
  const query = `
    query {
      getStill {
        title
        stills {
          image {
            _id
            path
          }
        }
      }
      getStillCategoryList(size: 100, sort: [{field: "title", order: "asc"}]) {
        items {
          _id
          title
          stills {
            image {
              _id
              path
            }
          }
        }
      }
    }
  `;

  const data = await gql(query);

  return [
    {
      type: 'still',
      id: 'main',
      title: 'Main Still Page',
      count: formatImages(data.getStill.stills).length
    }
  ].concat(data.getStillCategoryList.items.map(category => ({
    type: 'category',
    id: category._id,
    title: category.title,
    count: formatImages(category.stills).length
  })));
}

async function getGallery(type, id) {
  if (type === 'still') {
    const query = `
      query {
        getStill {
          title
          stills {
            image {
              _id
              path
            }
          }
        }
      }
    `;
    const data = await gql(query);

    return {
      type: 'still',
      id: 'main',
      title: 'Main Still Page',
      images: formatImages(data.getStill.stills)
    };
  }

  const query = `
    query ($id: ID!) {
      getStillCategory(_id: $id) {
        _id
        title
        stills {
          image {
            _id
            path
          }
        }
      }
    }
  `;
  const data = await gql(query, {id});

  return {
    type: 'category',
    id: data.getStillCategory._id,
    title: data.getStillCategory.title,
    images: formatImages(data.getStillCategory.stills)
  };
}

async function saveGallery(type, id, imageIds) {
  const stills = imageIds.map(imageId => ({
    image: {id: imageId}
  }));

  if (type === 'still') {
    const mutation = `
      mutation ($input: UpdateStillInput!) {
        updateStill(input: $input) {
          result {
            title
            stills {
              image {
                _id
              }
            }
          }
        }
      }
    `;
    const data = await gql(mutation, {input: {stills}});

    return {
      title: 'Main Still Page',
      count: data.updateStill.result.stills.length
    };
  }

  const mutation = `
    mutation ($input: UpdateStillCategoryInput!) {
      updateStillCategory(input: $input) {
        result {
          _id
          title
          stills {
            image {
              _id
            }
          }
        }
      }
    }
  `;
  const data = await gql(mutation, {input: {_id: id, stills}});

  return {
    title: data.updateStillCategory.result.title,
    count: data.updateStillCategory.result.stills.length
  };
}

function appHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Away Lands Still Grid Organizer</title>
  <style>
    :root {
      --bg: #f7f3ec;
      --panel: #fffaf2;
      --ink: #1d252b;
      --muted: #6f7477;
      --line: #dfd4c5;
      --accent: #1f4f6b;
      --danger: #a33a2d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: grid;
      grid-template-columns: minmax(220px, 1fr) auto;
      gap: 16px;
      align-items: end;
      padding: 18px 22px;
      background: rgba(247, 243, 236, 0.96);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(10px);
    }
    h1 {
      margin: 0 0 5px;
      font-family: Georgia, serif;
      font-weight: 400;
      font-size: 25px;
      letter-spacing: 0.02em;
    }
    p { margin: 0; color: var(--muted); }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
      align-items: center;
    }
    select, button {
      min-height: 38px;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: white;
      color: var(--ink);
      padding: 0 12px;
      font: inherit;
    }
    select { min-width: 280px; }
    button {
      cursor: pointer;
      font-weight: 600;
    }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }
    button.danger {
      color: var(--danger);
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
    main { padding: 22px; }
    .status {
      min-height: 24px;
      margin-bottom: 14px;
      color: var(--muted);
      font-size: 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
      gap: 12px;
    }
    .tile {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel);
      cursor: grab;
      user-select: none;
    }
    .tile.dragging {
      opacity: 0.35;
    }
    .tile.over {
      outline: 3px solid var(--accent);
      outline-offset: 2px;
    }
    .tile img {
      display: block;
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      background: #e8dfd3;
    }
    .tile__meta {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .tile__actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px;
      border-top: 1px solid var(--line);
    }
    .tile__actions button {
      min-height: 30px;
      border: 0;
      border-radius: 0;
      background: white;
      color: var(--muted);
      font-size: 12px;
      font-weight: 500;
    }
    .empty {
      padding: 40px;
      border: 1px dashed var(--line);
      border-radius: 6px;
      text-align: center;
      color: var(--muted);
      background: var(--panel);
    }
    @media (max-width: 760px) {
      header {
        position: static;
        grid-template-columns: 1fr;
      }
      .toolbar {
        justify-content: stretch;
      }
      select, button {
        width: 100%;
      }
      main {
        padding: 14px;
      }
      .grid {
        grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
      }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Still Grid Organizer</h1>
      <p>Drag photos into order, then save back to TakeShape.</p>
    </div>
    <div class="toolbar">
      <select id="gallerySelect"></select>
      <button id="reloadButton">Reload</button>
      <button id="resetButton">Reset order</button>
      <button id="saveButton" class="primary" disabled>Save order</button>
    </div>
  </header>

  <main>
    <div id="status" class="status">Loading galleries...</div>
    <div id="grid" class="grid"></div>
  </main>

  <script>
    const gallerySelect = document.getElementById('gallerySelect');
    const reloadButton = document.getElementById('reloadButton');
    const resetButton = document.getElementById('resetButton');
    const saveButton = document.getElementById('saveButton');
    const statusEl = document.getElementById('status');
    const gridEl = document.getElementById('grid');

    let gallery = null;
    let originalIds = [];
    let draggedId = null;

    function setStatus(message) {
      statusEl.textContent = message;
    }

    function setDirty() {
      const ids = gallery.images.map(image => image.id);
      const dirty = ids.join('|') !== originalIds.join('|');
      saveButton.disabled = !dirty;
      setStatus(dirty ? gallery.title + ': unsaved order changes.' : gallery.title + ': ' + ids.length + ' photos loaded.');
    }

    async function fetchJson(path, options) {
      const response = await fetch(path, options);
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    }

    function showError(prefix, error) {
      setStatus(prefix + ': ' + error.message);
      console.error(prefix, error);
    }

    async function loadGalleries() {
      setStatus('Loading galleries...');
      const data = await fetchJson('/api/galleries');
      gallerySelect.innerHTML = data.galleries.map(gallery => (
        '<option value="' + gallery.type + ':' + gallery.id + '">' +
          gallery.title.replace(/</g, '&lt;') + ' (' + gallery.count + ')' +
        '</option>'
      )).join('');
      await loadSelectedGallery();
    }

    async function loadSelectedGallery() {
      const parts = gallerySelect.value.split(':');
      setStatus('Loading gallery...');
      const data = await fetchJson('/api/gallery?type=' + encodeURIComponent(parts[0]) + '&id=' + encodeURIComponent(parts[1]));
      gallery = data.gallery;
      originalIds = gallery.images.map(image => image.id);
      renderGrid();
      setDirty();
    }

    function renderGrid() {
      if (!gallery || !gallery.images.length) {
        gridEl.innerHTML = '<div class="empty">No photos in this gallery.</div>';
        return;
      }

      gridEl.innerHTML = gallery.images.map((image, index) => (
        '<div class="tile" draggable="true" data-id="' + image.id + '">' +
          '<img src="' + image.url + '" alt="">' +
          '<div class="tile__meta"><span>#' + (index + 1) + '</span><span>drag</span></div>' +
          '<div class="tile__actions">' +
            '<button data-action="top" data-id="' + image.id + '">Top</button>' +
            '<button data-action="bottom" data-id="' + image.id + '">Bottom</button>' +
          '</div>' +
        '</div>'
      )).join('');
    }

    function moveImage(id, beforeId) {
      if (id === beforeId) return;
      const fromIndex = gallery.images.findIndex(image => image.id === id);
      const image = gallery.images[fromIndex];

      if (!image) return;

      gallery.images.splice(fromIndex, 1);

      if (!beforeId) {
        gallery.images.push(image);
      } else {
        const toIndex = gallery.images.findIndex(nextImage => nextImage.id === beforeId);
        gallery.images.splice(toIndex, 0, image);
      }

      renderGrid();
      setDirty();
    }

    gridEl.addEventListener('dragstart', event => {
      const tile = event.target.closest('.tile');
      if (!tile) return;
      draggedId = tile.dataset.id;
      tile.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
    });

    gridEl.addEventListener('dragend', () => {
      draggedId = null;
      document.querySelectorAll('.tile').forEach(tile => tile.classList.remove('dragging', 'over'));
    });

    gridEl.addEventListener('dragover', event => {
      const tile = event.target.closest('.tile');
      if (!tile || !draggedId || tile.dataset.id === draggedId) return;
      event.preventDefault();
      document.querySelectorAll('.tile.over').forEach(overTile => overTile.classList.remove('over'));
      tile.classList.add('over');
    });

    gridEl.addEventListener('drop', event => {
      const tile = event.target.closest('.tile');
      if (!tile || !draggedId) return;
      event.preventDefault();
      moveImage(draggedId, tile.dataset.id);
    });

    gridEl.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const index = gallery.images.findIndex(image => image.id === button.dataset.id);
      const image = gallery.images[index];

      if (!image) return;

      gallery.images.splice(index, 1);

      if (button.dataset.action === 'top') {
        gallery.images.unshift(image);
      } else {
        gallery.images.push(image);
      }

      renderGrid();
      setDirty();
    });

    gallerySelect.addEventListener('change', () => {
      loadSelectedGallery().catch(error => showError('Gallery load failed', error));
    });

    reloadButton.addEventListener('click', () => {
      loadSelectedGallery().catch(error => showError('Gallery reload failed', error));
    });

    resetButton.addEventListener('click', () => {
      if (!gallery) return;
      gallery.images.sort((a, b) => originalIds.indexOf(a.id) - originalIds.indexOf(b.id));
      renderGrid();
      setDirty();
    });

    saveButton.addEventListener('click', async () => {
      if (!gallery || saveButton.disabled) return;

      const ok = window.confirm('Save this new photo order to TakeShape?');
      if (!ok) return;

      saveButton.disabled = true;
      setStatus('Saving order to TakeShape...');

      try {
        await fetchJson('/api/gallery', {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            type: gallery.type,
            id: gallery.id,
            imageIds: gallery.images.map(image => image.id)
          })
        });

        originalIds = gallery.images.map(image => image.id);
        setDirty();
        setStatus(gallery.title + ': order saved.');
      } catch (error) {
        saveButton.disabled = false;
        setStatus('Save failed: ' + error.message);
      }
    });

    loadGalleries().catch(error => showError('Gallery list failed', error));
  </script>
</body>
</html>`;
}

async function handleRequest(req, res) {
  const parsed = url.parse(req.url, true);
  logRequest(req, parsed);

  try {
    if (req.method === 'HEAD' && parsed.pathname === '/') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && parsed.pathname === '/') {
      sendHtml(res, appHtml());
      return;
    }

    if (req.method === 'GET' && parsed.pathname === '/api/galleries') {
      sendJson(res, 200, {galleries: await getGalleries()});
      return;
    }

    if (req.method === 'GET' && parsed.pathname === '/api/gallery') {
      const gallery = await getGallery(parsed.query.type, parsed.query.id);
      sendJson(res, 200, {gallery});
      return;
    }

    if (req.method === 'PUT' && parsed.pathname === '/api/gallery') {
      const body = await readBody(req);

      if (!Array.isArray(body.imageIds)) {
        sendJson(res, 400, {error: 'Missing imageIds array.'});
        return;
      }

      const result = await saveGallery(body.type, body.id, body.imageIds);
      sendJson(res, 200, {result});
      return;
    }

    sendJson(res, 404, {error: 'Not found.'});
  } catch (error) {
    sendJson(res, 500, {error: error.message});
  }
}

http.createServer((req, res) => {
  handleRequest(req, res);
}).listen(PORT, HOST, () => {
  console.log('Still Grid Organizer running at http://' + HOST + ':' + PORT);
});
