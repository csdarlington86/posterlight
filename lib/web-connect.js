'use strict';
// "Sign in with Plex" for the web app, done by the browser itself.
// The person signs in on Plex's own pages. PosterLight never sees their password.
// The result (server address and sign-in token) is saved on this device only.
var STORAGE_KEY = require('./web-engine').STORAGE_KEY;

var CLIENT_KEY = 'posterlight.clientId';
var PRODUCT = 'PosterLight';
var PLEX_TV = 'https://plex.tv';

function createWebConnect(options) {
  var request = options.request;     // request(method, url, headers, timeoutMs, done(err, json))
  var storage = options.storage;
  var random = options.random || Math.random;

  // plex.tv wants a stable id for each installed copy of an app.
  function clientId() {
    var id = null;
    try { id = storage.getItem(CLIENT_KEY); } catch (e) { /* storage blocked */ }
    if (!id) {
      id = 'posterlight-web-';
      for (var i = 0; i < 24; i++) id += Math.floor(random() * 16).toString(16);
      try { storage.setItem(CLIENT_KEY, id); } catch (e) { /* a new id next time is fine */ }
    }
    return id;
  }

  function headers(token) {
    var h = { Accept: 'application/json', 'X-Plex-Product': PRODUCT, 'X-Plex-Client-Identifier': clientId() };
    if (token) h['X-Plex-Token'] = token;
    return h;
  }

  // A short code the person types at plex.tv/link on any other device. Good for old tablets.
  function createLinkCode(done) {
    request('POST', PLEX_TV + '/api/v2/pins', headers(), 10000, function (err, pin) {
      if (err || !pin || !pin.id || !pin.code) return done(err || { error: 'plex-failed' });
      done(null, { id: pin.id, code: String(pin.code).toUpperCase() });
    });
  }

  // A pin for signing in on this device: the page goes to Plex and comes back to `returnUrl`.
  function createRedirect(returnUrl, done) {
    request('POST', PLEX_TV + '/api/v2/pins?strong=true', headers(), 10000, function (err, pin) {
      if (err || !pin || !pin.id || !pin.code) return done(err || { error: 'plex-failed' });
      var back = returnUrl + (returnUrl.indexOf('?') === -1 ? '?' : '&') + 'pin=' + encodeURIComponent(pin.id);
      done(null, {
        id: pin.id,
        authUrl: 'https://app.plex.tv/auth#?clientID=' + encodeURIComponent(clientId()) +
          '&code=' + encodeURIComponent(pin.code) +
          '&forwardUrl=' + encodeURIComponent(back) +
          '&' + encodeURIComponent('context[device][product]') + '=' + encodeURIComponent(PRODUCT)
      });
    });
  }

  // done(null, token) once the person has signed in; done(null, null) while still waiting.
  function checkPin(id, done) {
    request('GET', PLEX_TV + '/api/v2/pins/' + encodeURIComponent(id), headers(), 10000, function (err, pin) {
      if (err) return done(err);
      done(null, (pin && pin.authToken) || null);
    });
  }

  // A web page served over https may only talk to https addresses.
  function secureUrls(connections) {
    var list = (Array.isArray(connections) ? connections : []).filter(function (c) {
      return c && /^https:\/\//.test(String(c.uri));
    });
    var urls = [];
    function add(c) { if (urls.indexOf(c.uri) === -1) urls.push(c.uri); }
    list.forEach(function (c) { if (c.local && !c.relay) add(c); });
    list.forEach(function (c) { if (!c.local && !c.relay) add(c); });
    list.forEach(function (c) { if (c.relay) add(c); });   // slow, but better than nothing
    return urls;
  }

  // Only servers the person owns: Plex shows "what is playing" to the owner alone.
  function listServers(token, done) {
    request('GET', PLEX_TV + '/api/v2/resources?includeHttps=1&includeRelay=1', headers(token), 15000, function (err, resources) {
      if (err) return done(err);
      var all = (Array.isArray(resources) ? resources : []).filter(function (r) {
        return r && String(r.provides || '').split(',').indexOf('server') !== -1;
      });
      done(null, {
        shared: all.filter(function (r) { return !r.owned; }).length,
        servers: all.filter(function (r) { return r.owned; }).map(function (r) {
          return { id: String(r.clientIdentifier), name: String(r.name || 'Plex server'),
                   accessToken: r.accessToken || token, urls: secureUrls(r.connections) };
        })
      });
    });
  }

  // Tries each address and saves the first one this device can reach.
  function connect(server, done) {
    function tryNext(i) {
      if (i >= server.urls.length) return done({ error: 'unreachable' });
      // A signed-in request, because Plex lets a website read only those answers.
      request('GET', server.urls[i] + '/status/sessions', { 'X-Plex-Token': server.accessToken, Accept: 'application/json' },
        6000, function (err, json) {
          if (err && err.status === 401) return done({ error: 'not-owner' });
          if (err || !json || !json.MediaContainer) return tryNext(i + 1);
          try {
            storage.setItem(STORAGE_KEY, JSON.stringify({ serverUrl: server.urls[i], token: server.accessToken, serverName: server.name }));
          } catch (e) {
            return done({ error: 'storage' });
          }
          done(null, { name: server.name });
        });
    }
    tryNext(0);
  }

  return { createLinkCode: createLinkCode, createRedirect: createRedirect, checkPin: checkPin, listServers: listServers, connect: connect };
}

module.exports = { createWebConnect: createWebConnect };
