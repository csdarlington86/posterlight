'use strict';
// Talks to plex.tv for the "Sign in with Plex" setup step.
// The person signs in on Plex's own page. PosterLight never sees their password.

var PRODUCT = 'PosterLight';

function createPlexAccount(options) {
  var fetchImpl = options.fetchImpl || fetch;
  var clientId = options.clientId;
  var baseUrl = options.baseUrl || 'https://plex.tv';
  var timeoutMs = options.timeoutMs || 10000;

  function headers(token) {
    var h = {
      Accept: 'application/json',
      'X-Plex-Product': PRODUCT,
      'X-Plex-Client-Identifier': clientId
    };
    if (token) h['X-Plex-Token'] = token;
    return h;
  }

  function request(method, path, token) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    return fetchImpl(baseUrl + path, { method: method, headers: headers(token), redirect: 'manual', signal: controller.signal })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('plex.tv answered ' + res.status);
        return res.json();
      }, function () {
        clearTimeout(timer);
        throw new Error('Could not reach plex.tv');
      });
  }

  // Step 1: ask for a pin, and build the address of Plex's sign-in page for it.
  function createPin() {
    return request('POST', '/api/v2/pins?strong=true').then(function (pin) {
      var authUrl = 'https://app.plex.tv/auth#?clientID=' + encodeURIComponent(clientId) +
        '&code=' + encodeURIComponent(pin.code) +
        '&' + encodeURIComponent('context[device][product]') + '=' + encodeURIComponent(PRODUCT);
      return { id: pin.id, authUrl: authUrl };
    });
  }

  // Step 2: null while the person has not finished signing in, then their account token.
  function checkPin(id) {
    return request('GET', '/api/v2/pins/' + encodeURIComponent(id)).then(function (pin) {
      return (pin && pin.authToken) || null;
    });
  }

  function serverUrls(connections) {
    var list = (Array.isArray(connections) ? connections : []).filter(function (c) { return c && !c.relay; });
    var urls = [];
    function add(url) { if (url && urls.indexOf(url) === -1) urls.push(url); }
    // On the home network a plain address is the most dependable, so try those first.
    list.forEach(function (c) { if (c.local && c.address && c.port) add('http://' + c.address + ':' + c.port); });
    list.forEach(function (c) { if (c.local) add(c.uri); });
    list.forEach(function (c) { if (!c.local) add(c.uri); });
    return urls;
  }

  // Step 3: the Plex servers this account can reach.
  function listServers(token) {
    return request('GET', '/api/v2/resources?includeHttps=1&includeRelay=0', token).then(function (resources) {
      return (Array.isArray(resources) ? resources : []).filter(function (r) {
        return r && String(r.provides || '').split(',').indexOf('server') !== -1;
      }).map(function (r) {
        return {
          id: String(r.clientIdentifier),
          name: String(r.name || 'Plex server'),
          owned: !!r.owned,
          accessToken: r.accessToken || token,
          urls: serverUrls(r.connections)
        };
      });
    });
  }

  return { createPin: createPin, checkPin: checkPin, listServers: listServers };
}

module.exports = { createPlexAccount: createPlexAccount };
