(function () {
  'use strict';

  const CHANNEL = 'awaylands-story-importance';
  const SUBCATEGORY_CHANNEL = 'awaylands-subcategory-editor';
  const nativeFetch = window.fetch.bind(window);
  const nativeXhrOpen = window.XMLHttpRequest && window.XMLHttpRequest.prototype.open;
  const nativeXhrSetRequestHeader = window.XMLHttpRequest && window.XMLHttpRequest.prototype.setRequestHeader;
  const nativeXhrSend = window.XMLHttpRequest && window.XMLHttpRequest.prototype.send;
  let latestGraphqlHeaders = {};

  function graphqlEndpoint() {
    const match = window.location.pathname.match(/\/project\/([^/]+)\/branch\/([^/]+)/i);

    if (!match) return null;
    const projectId = match[1];
    const branch = decodeURIComponent(match[2]);
    const branchPath = branch === 'production' ? 'production' : `development/${encodeURIComponent(branch)}`;

    return `https://api.takeshape.io/project/${projectId}/${branchPath}/graphql`;
  }

  function isProjectGraphql(url) {
    return /api\.takeshape\.io\/project\/[^/]+\/(?:production|development\/[^/]+)\/graphql/i.test(String(url || ''));
  }

  function rememberHeaders(headers) {
    if (!headers) return;

    try {
      const normalized = new Headers(headers);
      normalized.forEach((value, key) => {
        const name = key.toLowerCase();
        if (name !== 'content-length' && name !== 'content-type') latestGraphqlHeaders[name] = value;
      });
    } catch (error) {
      // TakeShape can pass a Headers-like object that is not enumerable. The
      // authenticated browser session is still available through credentials.
    }
  }

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input && input.url;

    if (isProjectGraphql(url)) {
      rememberHeaders(input && input.headers);
      rememberHeaders(init && init.headers);
    }
    return nativeFetch(input, init);
  };

  if (nativeXhrOpen && nativeXhrSetRequestHeader && nativeXhrSend) {
    window.XMLHttpRequest.prototype.open = function (method, url) {
      this.__awaylandsGraphqlRequest = isProjectGraphql(url) ? { headers: {} } : null;
      return nativeXhrOpen.apply(this, arguments);
    };
    window.XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      if (this.__awaylandsGraphqlRequest) this.__awaylandsGraphqlRequest.headers[name] = value;
      return nativeXhrSetRequestHeader.apply(this, arguments);
    };
    window.XMLHttpRequest.prototype.send = function () {
      if (this.__awaylandsGraphqlRequest) rememberHeaders(this.__awaylandsGraphqlRequest.headers);
      return nativeXhrSend.apply(this, arguments);
    };
  }

  async function graphql(query, variables) {
    const endpoint = graphqlEndpoint();
    if (!endpoint) throw new Error('The TakeShape project could not be identified.');

    const response = await nativeFetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: Object.assign({}, latestGraphqlHeaders, {'Content-Type': 'application/json'}),
      body: JSON.stringify({query, variables})
    });
    if (!response.ok) throw new Error(`TakeShape returned ${response.status}.`);

    const payload = await response.json();
    if (payload.errors && payload.errors.length) {
      throw new Error(payload.errors.map(error => error.message).join(' '));
    }
    return payload.data;
  }

  async function listImportance() {
    const pages = await Promise.all([0, 250, 500, 750].map(from => graphql(`query AwaylandsStoryImportancePage($from: Int!) {
      getStoryList(size: 250, from: $from, onlyEnabled: false) { items { _id _version title isImportant } }
    }`, {from})));

    return pages.flatMap(data => data.getStoryList && data.getStoryList.items || []);
  }

  async function updateImportance(story) {
    const data = await graphql(`mutation AwaylandsStoryImportanceUpdate($input: UpdateStoryInput!) {
      updateStory(input: $input) { result { _id _version title isImportant } }
    }`, {
      input: {
        _id: story.id,
        _version: story.version,
        isImportant: Boolean(story.isImportant)
      }
    });

    return data.updateStory.result;
  }

  async function listCategories() {
    const data = await graphql(`query AwaylandsSubcategoryEditorList {
      getCategoryList(size: 250, onlyEnabled: false) {
        items { _id title parentCategory { _id title } }
      }
    }`);

    return data.getCategoryList && data.getCategoryList.items || [];
  }

  window.addEventListener('message', event => {
    const message = event.data;
    if (event.source !== window || !message || message.channel !== CHANNEL || message.direction !== 'request') return;

    const task = message.type === 'list' ? listImportance() :
      message.type === 'update' ? updateImportance(message.story || {}) :
      Promise.reject(new Error('Unknown story importance request.'));

    task.then(result => {
      window.postMessage({
        channel: CHANNEL,
        direction: 'response',
        requestId: message.requestId,
        type: message.type,
        result
      }, window.location.origin);
    }).catch(error => {
      window.postMessage({
        channel: CHANNEL,
        direction: 'response',
        requestId: message.requestId,
        type: message.type,
        error: error.message || String(error)
      }, window.location.origin);
    });
  });

  window.addEventListener('message', event => {
    const message = event.data;
    if (event.source !== window || !message || message.channel !== SUBCATEGORY_CHANNEL || message.direction !== 'request') return;

    listCategories().then(result => {
      window.postMessage({
        channel: SUBCATEGORY_CHANNEL,
        direction: 'response',
        requestId: message.requestId,
        result
      }, window.location.origin);
    }).catch(error => {
      window.postMessage({
        channel: SUBCATEGORY_CHANNEL,
        direction: 'response',
        requestId: message.requestId,
        error: error.message || String(error)
      }, window.location.origin);
    });
  });
}());
