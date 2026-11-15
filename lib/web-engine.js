'use strict';
// The web app's engine. It does in the browser what the helper does on a computer:
// asks the person's own Plex server what is playing and builds the status the page draws.
// Nothing here touches the DOM or the network directly. The caller passes `request` and `storage`,
// so the same code runs under the Node tests.
var parser = require('./plex-parser');
var createTracker = require('./session-tracker').createTracker;
var buildStatus = require('./status').buildStatus;

var STORAGE_KEY = 'posterlight.web';
var POLL_MS = 2000;
var REQUEST_MS = 8000;
var MAX_IMAGES = 5000;

function setupStatus() {
  return { plexOk: false, player: null, state: 'setup', brightness: 'full', media: null };
}

function readConfig(storage) {
  try {
    var c = JSON.parse(storage.getItem(STORAGE_KEY));
    if (c && typeof c.token === 'string' && c.token && /^https?:\/\/[^\s\/]+$/.test(String(c.serverUrl))) {
      return { serverUrl: c.serverUrl, token: c.token, serverName: String(c.serverName || 'Plex') };
    }
  } catch (e) { /* nothing saved, or storage is blocked */ }
  return null;
}

function createWebEngine(options) {
  var request = options.request;          // request(method, url, headers, timeoutMs, done(err, json))
  var storage = options.storage;
  var now = options.now || Date.now;
  var later = options.setTimer || setTimeout;

  var config = readConfig(storage);
  var tracker = createTracker({ now: now, pauseGraceMs: 10000, fullBrightMs: 180000 });
  var needsSignIn = false;   // the server refused the saved sign-in
  var started = false;

  var imageIds = {};         // Plex path -> short id
  var imageSources = {};     // short id -> Plex path
  var imageCount = 0;
  var details = {};          // metadata key -> 'pending' | { cast }

  function plex(path, done) {
    request('GET', config.serverUrl + path, { 'X-Plex-Token': config.token, Accept: 'application/json' }, REQUEST_MS, done);
  }

  function trim(cache, max) {
    var keys = Object.keys(cache);
    if (keys.length > max) delete cache[keys[0]];
  }

  function detailsKey(session) {
    if (session.type === 'movie') return session.ratingKey;
    if (session.type === 'episode') return session.showRatingKey;
    return null;
  }

  // One request per title gives the full cast.
  function loadDetails(session) {
    var key = detailsKey(session);
    if (!key || details[key]) return;
    details[key] = 'pending';
    trim(details, 40);
    plex('/library/metadata/' + encodeURIComponent(key), function (err, json) {
      if (err) { delete details[key]; return; }
      details[key] = { cast: parser.parseCast(json) };
    });
  }

  function loadedDetails(session) {
    var d = details[detailsKey(session)];
    return d && d !== 'pending' ? d : null;
  }

  function castFor(session) {
    var d = loadedDetails(session);
    return d && d.cast.length ? d.cast : null;
  }

  var images = {
    idFor: function (source) {
      if (!source || typeof source !== 'string') return null;
      if (!imageIds[source]) {
        if (imageCount >= MAX_IMAGES) { imageIds = {}; imageSources = {}; imageCount = 0; }
        imageCount += 1;
        imageIds[source] = 'p' + imageCount + 'x' + String(now()).slice(-6);
        imageSources[imageIds[source]] = source;
      }
      return imageIds[source];
    }
  };

  var deps = { images: images, castFor: castFor };

  function poll() {
    if (!config || needsSignIn) { started = false; return; }
    plex('/status/sessions', function (err, json) {
      try {
        if (err) {
          if (err.status === 401) needsSignIn = true;
          tracker.update(null);
        } else {
          var sessions = parser.parseSessions(json);
          tracker.update(sessions);
          sessions.forEach(loadDetails);
        }
      } catch (e) { /* one bad answer must not stop the loop */ }
      later(poll, POLL_MS);
    });
  }

  return {
    // Begins asking Plex. Safe to call more than once.
    start: function () {
      if (started || !config) return;
      started = true;
      poll();
    },
    isConfigured: function () { return !!config && !needsSignIn; },
    serverName: function () { return config ? config.serverName : null; },
    status: function (playerId) {
      if (!config || needsSignIn) return setupStatus();
      return buildStatus(tracker.view(playerId || 'any'), deps);
    },
    players: function () { return config ? tracker.players() : []; },
    // The address of a resized image on the person's own Plex server.
    // An <img> tag cannot send a header, so the sign-in goes in the address. It travels only to their server.
    imageUrl: function (id, w, h) {
      var source = imageSources[id];
      if (!config || !source) return '';
      return config.serverUrl + '/photo/:/transcode?width=' + w + '&height=' + h + '&minSize=1&upscale=0&url=' +
        encodeURIComponent(source) + '&X-Plex-Token=' + encodeURIComponent(config.token);
    },
    signOut: function () {
      try { storage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
      config = null;
    }
  };
}

module.exports = { createWebEngine: createWebEngine, STORAGE_KEY: STORAGE_KEY };
