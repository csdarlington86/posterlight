'use strict';
// PosterLight helper. Run it with: npm start
//
// With Plex settings it polls Plex and serves the poster page.
// Without them it starts in setup mode: open /setup in a browser to sign in with Plex.
var fs = require('fs');
var os = require('os');
var path = require('path');
var crypto = require('crypto');

var configFile = require('./lib/config');
var parser = require('./lib/plex-parser');
var createTracker = require('./lib/session-tracker').createTracker;
var createPlexClient = require('./lib/plex-client').createPlexClient;
var createPlexAccount = require('./lib/plex-account').createPlexAccount;
var createImageRegistry = require('./lib/image-registry').createImageRegistry;
var buildStatus = require('./lib/status').buildStatus;
var createHttpServer = require('./lib/http-server').createHttpServer;
var setupModule = require('./lib/setup');

var ROOT = __dirname;
// Docker and NAS installs keep settings and state outside the program folder.
var CONFIG_PATH = process.env.POSTERLIGHT_CONFIG || path.join(ROOT, 'config.json');
var DATA_DIR = process.env.POSTERLIGHT_DATA || path.join(ROOT, 'data');
var PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
var CLIENT_ID_FILE = path.join(DATA_DIR, 'client-id');
var POLL_MS = 2000;
var LIBRARY_REFRESH_MS = 6 * 60 * 60 * 1000;
var SETUP_STATUS = { plexOk: false, player: null, state: 'setup', brightness: 'full', media: null };

var port = configFile.loadPort(CONFIG_PATH, process.env);
var images = createImageRegistry();

// ---- everything below "plex" is replaced when setup saves new settings ----
var plex = null;            // null means setup mode
var tracker = null;
var plexWasOk = null;
var savedPlayers = '';
var castCache = {};         // metadata key -> cast list, or 'pending'
var posterCache = {};       // metadata key -> other posters of the title, or 'pending'
var library = [];           // up to 200 movies per library, for the idle screen
var libraryAt = null;       // when the library was last asked for

function trim(cache, max) {
  var keys = Object.keys(cache);
  if (keys.length > max) delete cache[keys[0]];
}

function castKey(session) {
  if (session.type === 'movie') return session.ratingKey;
  if (session.type === 'episode') return session.showRatingKey;
  return null;
}

// One metadata request per title gives the full cast.
function fetchDetails(client, session) {
  var key = castKey(session);
  if (!key || castCache[key]) return;
  castCache[key] = 'pending';
  trim(castCache, 50);
  client.getJson('/library/metadata/' + encodeURIComponent(key)).then(function (json) {
    if (client !== plex) return;
    castCache[key] = parser.parseCast(json);
  }).catch(function () {
    delete castCache[key];
  });
}

// Asks Plex for up to 200 movies per library, in random order. A new set comes every 6 hours.
function refreshLibrary() {
  var client = plex;
  if (!client) return;
  client.getJson('/library/sections').then(function (json) {
    return Promise.all(parser.parseMovieSections(json).map(function (key) {
      return client.getJson('/library/sections/' + encodeURIComponent(key) + '/all?type=1&sort=random&X-Plex-Container-Start=0&X-Plex-Container-Size=200').then(parser.parseLibraryMovies);
    }));
  }).then(function (lists) {
    if (client === plex) library = [].concat.apply([], lists);
  }).catch(function () {
    libraryAt = Date.now() - LIBRARY_REFRESH_MS + 60000;   // try again in a minute
  });
}

var deps = {
  images: images,
  postersFor: function (session) {
    var key = castKey(session);
    var client = plex;
    if (!key || !client) return null;
    if (!posterCache[key]) {
      posterCache[key] = 'pending';
      trim(posterCache, 50);
      client.getJson('/library/metadata/' + encodeURIComponent(key) + '/posters').then(parser.parsePosters, function () {
        return [];   // no other posters: keep the one in use
      }).then(function (list) {
        if (client === plex) posterCache[key] = list;
      });
    }
    return posterCache[key] === 'pending' ? null : posterCache[key];
  },
  library: function () {
    if (libraryAt === null || Date.now() - libraryAt > LIBRARY_REFRESH_MS) {
      libraryAt = Date.now();
      refreshLibrary();
    }
    return library;
  },
  castFor: function (session) {
    var cast = castCache[castKey(session)];
    return Array.isArray(cast) && cast.length ? cast : null;
  }
};

// ---- Plex polling ----

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
  var client = plex;
  if (!client) return void setTimeout(poll, POLL_MS);
  client.getJson('/status/sessions').then(function (json) {
    if (client !== plex) return;   // settings changed while this request was in flight
    var sessions = parser.parseSessions(json);
    tracker.update(sessions);
    sessions.forEach(function (session) { fetchDetails(client, session); });
    savePlayers();
    logPlexState(true);
  }).catch(function (err) {
    if (client !== plex) return;
    tracker.update(null);
    logPlexState(false, err.message);
  }).catch(function (err) {
    console.error('Unexpected error while reading Plex: ' + err.message);
  }).then(function () {
    // Whatever happened above, the next poll is always scheduled.
    setTimeout(poll, POLL_MS);
  });
}

// Starts (or restarts) everything that depends on the Plex settings.
function usePlex(config) {
  plex = createPlexClient({ plexUrl: config.plexUrl, plexToken: config.plexToken });
  tracker = createTracker({ now: Date.now, pauseGraceMs: 10000, fullBrightMs: 180000 });
  plexWasOk = null;
  castCache = {}; posterCache = {}; library = []; libraryAt = null;
  try {
    tracker.loadPlayers(JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8')));
  } catch (e) { /* no saved players yet */ }
}

// ---- setup ----

function clientId() {
  // plex.tv wants a stable id for each installed copy of an app.
  try {
    var saved = fs.readFileSync(CLIENT_ID_FILE, 'utf8').trim();
    if (saved) return saved;
  } catch (e) { /* first run */ }
  var id = 'posterlight-' + crypto.randomBytes(12).toString('hex');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CLIENT_ID_FILE, id);
  } catch (e) { /* a new id next start is fine */ }
  return id;
}

var setupCode = setupModule.newSetupCode();
var setup = setupModule.createSetup({
  setupCode: setupCode,
  // POSTERLIGHT_PLEX_TV_URL exists only so the end-to-end test can stand in for plex.tv.
  account: createPlexAccount({ clientId: clientId(), baseUrl: process.env.POSTERLIGHT_PLEX_TV_URL || undefined }),
  testServer: function (url, token) {
    return createPlexClient({ plexUrl: url, plexToken: token, timeoutMs: 4000 }).getJson('/identity').then(function (json) {
      return !!(json && json.MediaContainer && json.MediaContainer.machineIdentifier);
    }, function () { return false; });
  },
  saveConfig: function (values) {
    configFile.saveConfig(CONFIG_PATH, values);
    usePlex(values);
    console.log('Setup saved. Connecting to Plex.');
  },
  isConfigured: function () { return !!plex; }
});

// ---- start ----

try {
  usePlex(configFile.loadConfig(CONFIG_PATH, process.env));
} catch (e) {
  console.log('PosterLight is not connected to Plex yet. (' + e.message.split('.')[0] + '.)');
}

var server = createHttpServer({
  publicDir: path.join(ROOT, 'public'),
  images: images,
  setup: setup,
  getStatus: function (playerId) { return plex ? buildStatus(tracker.view(playerId), deps) : SETUP_STATUS; },
  getPlayers: function () { return plex ? tracker.players() : []; },
  getImage: function (source, w, h) {
    return plex ? plex.getImage(source, w, h) : Promise.reject(new Error('not set up'));
  },
  isPlexOk: function () { return plexWasOk === true; }
});

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.error('PosterLight cannot start: port ' + port + ' is already in use. Close the other copy, or set a different port.');
  } else {
    console.error('PosterLight cannot start: ' + e.message);
  }
  process.exit(1);
});

server.listen(port, function () {
  var nets = os.networkInterfaces();
  var addresses = [];
  Object.keys(nets).forEach(function (name) {
    (nets[name] || []).forEach(function (n) {
      if (n.family === 'IPv4' && !n.internal) addresses.push(n.address);
    });
  });
  var first = addresses[0] || 'localhost';
  if (!plex) {
    console.log('');
    console.log('  To set up, open this address in a web browser on this computer:');
    console.log('    http://localhost:' + port + '/setup');
    console.log('');
    console.log('  Or open http://' + first + ':' + port + '/setup on another device');
    console.log('  and type this setup code: ' + setupCode);
    console.log('');
  }
  (addresses.length ? addresses : ['localhost']).forEach(function (a) {
    console.log('PosterLight is running. Open http://' + a + ':' + port + ' on your device.');
  });
  if (plex) console.log('To connect to a different Plex server, open http://localhost:' + port + '/setup on this computer. Setup code for other devices: ' + setupCode);
  poll();
});
