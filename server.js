'use strict';
// PosterLight helper. Run it with: npm start
var fs = require('fs');
var os = require('os');
var path = require('path');

var loadConfig = require('./lib/config').loadConfig;
var parser = require('./lib/plex-parser');
var createTracker = require('./lib/session-tracker').createTracker;
var createFactStore = require('./lib/fact-store').createFactStore;
var buildLibraryIndex = require('./lib/library-index').buildLibraryIndex;
var buildFallbackFacts = require('./lib/fallback-facts').buildFallbackFacts;
var createPlexClient = require('./lib/plex-client').createPlexClient;
var createImageRegistry = require('./lib/image-registry').createImageRegistry;
var buildStatus = require('./lib/status').buildStatus;
var createHttpServer = require('./lib/http-server').createHttpServer;

var ROOT = __dirname;
var DATA_DIR = path.join(ROOT, 'data');
var PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
var POLL_MS = 2000;
var LIBRARY_REFRESH_MS = 6 * 60 * 60 * 1000;
var FACT_CACHE_MS = 60000;

var config;
try {
  config = loadConfig(path.join(ROOT, 'config.json'), process.env);
} catch (e) {
  console.error('PosterLight cannot start: ' + e.message);
  process.exit(1);
}

var plex = createPlexClient({ plexUrl: config.plexUrl, plexToken: config.plexToken });
var images = createImageRegistry();
var tracker = createTracker({ now: Date.now, pauseGraceMs: 10000, fullBrightMs: 180000 });
var factStore = createFactStore({
  factsDir: path.join(ROOT, 'facts'),
  statePath: path.join(DATA_DIR, 'fact-state.json')
});
var libraryIndex = buildLibraryIndex([]);

// ---- small caches, keyed by the title that is playing ----
var guidCache = {};      // metadata key -> external ids (imdb://..., tmdb://...)
var castCache = {};      // metadata key -> cast list, or 'pending'
var factCache = {};      // ratingKey -> { at, facts }
var fallbackCache = {};  // ratingKey -> facts array

function trim(cache, max) {
  var keys = Object.keys(cache);
  if (keys.length > max) delete cache[keys[0]];
}

function castKey(session) {
  if (session.type === 'movie') return session.ratingKey;
  if (session.type === 'episode') return session.showRatingKey;
  return null;
}

function fetchCast(session) {
  var key = castKey(session);
  if (!key || castCache[key]) return;
  castCache[key] = 'pending';
  trim(castCache, 50);
  trim(guidCache, 50);
  plex.getJson('/library/metadata/' + encodeURIComponent(key)).then(function (json) {
    castCache[key] = parser.parseCast(json);
    guidCache[key] = parser.parseGuids(json);
    delete factCache[session.ratingKey];   // look again, now that the ids are known
  }, function () {
    delete castCache[key];
  });
}

var deps = {
  images: images,
  factsFor: function (session) {
    // Read the fact file at most once a minute per title, so a new or edited file is picked up
    // without a restart and the disk is not read on every device request.
    var key = session.ratingKey;
    var hit = factCache[key];
    var now = Date.now();
    if (!hit || now - hit.at > FACT_CACHE_MS) {
      hit = factCache[key] = { at: now, facts: factStore.factsFor(session, guidCache[castKey(session)] || []) };
      trim(factCache, 50);
    }
    return hit.facts;
  },
  fallbackFor: function (session) {
    var key = session.ratingKey;
    if (!Object.prototype.hasOwnProperty.call(fallbackCache, key)) {
      var cast = deps.castFor(session);
      var withCast = cast ? Object.assign({}, session, { cast: cast }) : session;
      fallbackCache[key] = buildFallbackFacts(withCast, libraryIndex);
      trim(fallbackCache, 50);
    }
    return fallbackCache[key];
  },
  castFor: function (session) {
    var cast = castCache[castKey(session)];
    return Array.isArray(cast) && cast.length ? cast : null;
  }
};

// ---- Plex polling ----
var plexWasOk = null;
var savedPlayers = '';

function savePlayers() {
  var list = tracker.players().map(function (p) { return { id: p.id, name: p.name }; });
  var text = JSON.stringify(list);
  if (text === savedPlayers) return;
  savedPlayers = text;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PLAYERS_FILE, text);
  } catch (e) { /* the list is a convenience; ignore a failed save */ }
}

function logPlexState(ok, message) {
  if (ok === plexWasOk) return;
  plexWasOk = ok;
  console.log(ok ? 'Connected to Plex.' : 'Plex is not reachable (' + message + '). Retrying every 2 seconds.');
}

function poll() {
  plex.getJson('/status/sessions').then(function (json) {
    var sessions = parser.parseSessions(json);
    tracker.update(sessions);
    sessions.forEach(fetchCast);
    savePlayers();
    logPlexState(true);
  }, function (err) {
    tracker.update(null);
    logPlexState(false, err.message);
  }).then(function () {
    setTimeout(poll, POLL_MS);
  });
}

function refreshLibrary() {
  plex.getJson('/library/sections').then(function (json) {
    var dirs = (json && json.MediaContainer && json.MediaContainer.Directory) || [];
    var wanted = dirs.filter(function (d) { return d && (d.type === 'movie' || d.type === 'show'); });
    return Promise.all(wanted.map(function (d) {
      return plex.getJson('/library/sections/' + encodeURIComponent(d.key) + '/all').then(parser.parseLibraryItems);
    }));
  }).then(function (lists) {
    var items = [].concat.apply([], lists);
    libraryIndex = buildLibraryIndex(items);
    fallbackCache = {};
    console.log('Library index ready: ' + items.length + ' titles.');
  }, function () { /* the next refresh tries again */ });
}

// ---- start ----
try {
  tracker.loadPlayers(JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8')));
} catch (e) { /* no saved players yet */ }

var server = createHttpServer({
  publicDir: path.join(ROOT, 'public'),
  images: images,
  getStatus: function (playerId) { return buildStatus(tracker.view(playerId), deps); },
  getPlayers: function () { return tracker.players(); },
  getImage: function (source, w, h) { return plex.getImage(source, w, h); },
  isPlexOk: function () { return plexWasOk === true; }
});

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.error('PosterLight cannot start: port ' + config.port + ' is already in use. Change "port" in config.json.');
  } else {
    console.error('PosterLight cannot start: ' + e.message);
  }
  process.exit(1);
});

server.listen(config.port, function () {
  var nets = os.networkInterfaces();
  var addresses = [];
  Object.keys(nets).forEach(function (name) {
    (nets[name] || []).forEach(function (n) {
      if (n.family === 'IPv4' && !n.internal) addresses.push(n.address);
    });
  });
  if (!addresses.length) addresses.push('localhost');
  addresses.forEach(function (a) {
    console.log('PosterLight is running. Open http://' + a + ':' + config.port + ' on your device.');
  });
  poll();
  refreshLibrary();
  setInterval(refreshLibrary, LIBRARY_REFRESH_MS);
});
