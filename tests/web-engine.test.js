'use strict';
var test = require('node:test');
var assert = require('node:assert');
var web = require('../lib/web-engine');

function memoryStorage(initial) {
  var data = initial || {};
  return {
    data: data,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; }
  };
}

var SAVED = JSON.stringify({ serverUrl: 'https://a.plex.direct:32400', token: 'WEB-TOKEN', serverName: 'Den PC' });
var MOVIE = require('./fixtures/sessions-movie.json');

function world(routes, saved) {
  var calls = [];
  var timers = [];
  var clock = { t: 5000000 };
  var engine = web.createWebEngine({
    storage: memoryStorage(saved === null ? {} : { 'posterlight.web': saved || SAVED }),
    now: function () { return clock.t; },
    setTimer: function (fn) { timers.push(fn); },
    request: function (method, url, headers, timeoutMs, done) {
      calls.push({ method: method, url: url, headers: headers });
      var path = url.replace('https://a.plex.direct:32400', '');
      var hit = routes[path.split('?')[0]] !== undefined ? routes[path.split('?')[0]] : routes['*'];
      if (hit === undefined) return done({ status: 404 });
      if (hit && hit.__error) return done(hit.__error);
      done(null, JSON.parse(JSON.stringify(hit)));
    }
  });
  return { engine: engine, calls: calls, clock: clock, tick: function () { var t = timers.splice(0); t.forEach(function (f) { f(); }); } };
}

var INDEX = { movies: { ids: { 'imdb://tt0078748': 'alien-1979' }, names: { 'alien-1979': 1 } }, shows: { ids: {}, names: {} } };
function facts(n) { var o = []; for (var i = 0; i < n; i++) o.push('Alien fact ' + i); return o; }

test('with nothing saved the engine reports that setup is needed and asks nobody', function () {
  var w = world({}, null);
  w.engine.start();
  assert.strictEqual(w.engine.isConfigured(), false);
  assert.strictEqual(w.engine.status('any').state, 'setup');
  assert.deepStrictEqual(w.engine.players(), []);
  assert.strictEqual(w.calls.length, 0);
});

test('damaged saved settings count as nothing saved', function () {
  assert.strictEqual(world({}, '{broken').engine.isConfigured(), false);
  assert.strictEqual(world({}, JSON.stringify({ serverUrl: 'javascript:alert(1)', token: 't' })).engine.isConfigured(), false);
  assert.strictEqual(world({}, JSON.stringify({ serverUrl: 'https://a.plex.direct:32400' })).engine.isConfigured(), false);
});

test('it polls the saved server with the token in a header and shows what is playing', function () {
  var w = world({ '/status/sessions': MOVIE, '/library/metadata/101': MOVIE, 'facts/index.json': INDEX });
  w.engine.start();
  assert.strictEqual(w.calls[0].url, 'https://a.plex.direct:32400/status/sessions');
  assert.strictEqual(w.calls[0].headers['X-Plex-Token'], 'WEB-TOKEN');
  assert.ok(w.calls[0].url.indexOf('WEB-TOKEN') === -1);
  var s = w.engine.status('any');
  assert.strictEqual(s.state, 'playing');
  assert.strictEqual(s.media.title, 'Alien');
  assert.strictEqual(s.player.name, 'Living Room');
  assert.deepStrictEqual(w.engine.players(), [{ id: 'abc', name: 'Living Room', active: true }]);
  assert.strictEqual(w.engine.status('nobody').state, 'idle');
});

test('image addresses point at the person\'s own server and ask for the given size', function () {
  var w = world({ '/status/sessions': MOVIE, '/library/metadata/101': MOVIE });
  w.engine.start();
  var s = w.engine.status('any');
  var url = w.engine.imageUrl(s.media.posterId, 400, 600);
  assert.ok(url.indexOf('https://a.plex.direct:32400/photo/:/transcode?width=400&height=600') === 0);
  assert.ok(url.indexOf('url=%2Flibrary%2Fmetadata%2F101%2Fthumb%2F1') !== -1);
  assert.strictEqual(w.engine.imageUrl('unknown-id', 100, 100), '');
  assert.ok(JSON.stringify(s).indexOf('WEB-TOKEN') === -1, 'the status itself never carries the token');
});

test('a fact file is found by id and its facts appear at the right moment', function () {
  var w = world({ '/status/sessions': MOVIE, '/library/metadata/101': { MediaContainer: { Metadata: [{ Guid: [{ id: 'imdb://tt0078748' }], Role: [] }] } },
    'facts/index.json': INDEX, 'facts/movies/alien-1979.json': { title: 'Alien', facts: facts(20) } });
  w.engine.start();
  w.engine.status('any');   // starts loading the index and the file
  w.engine.status('any');
  // The fixture is 117 minutes long. Slot 0 of 15 starts at 7020000 / 16 = 438750 ms.
  w.clock.t += 438750 - 60000 + 1000;
  var s = w.engine.status('any');
  assert.ok(s.fact, 'a fact is showing');
  assert.strictEqual(s.fact.total, 15);
  assert.match(s.fact.text, /^Alien fact \d+$/);
});

test('with no fact file the Plex-data facts are used', function () {
  var w = world({ '/status/sessions': MOVIE, '/library/metadata/101': MOVIE, 'facts/index.json': { movies: {}, shows: {} } });
  w.engine.start();
  w.engine.status('any');
  w.clock.t += 2000000;
  var texts = {};
  for (var i = 0; i < 4000; i++) { w.clock.t += 1000; var s = w.engine.status('any'); if (s.fact) texts[s.fact.text] = 1; }
  assert.ok(texts['Alien was released in 1979.'] || texts['Directed by Ridley Scott.'] || Object.keys(texts).length > 0);
});

test('losing the server keeps the last screen; the next good answer recovers', function () {
  var routes = { '/status/sessions': MOVIE, '/library/metadata/101': MOVIE };
  var w = world(routes);
  w.engine.start();
  routes['/status/sessions'] = { __error: { status: 0 } };
  w.tick();
  var s = w.engine.status('any');
  assert.strictEqual(s.state, 'playing');
  assert.strictEqual(s.plexOk, false);
  routes['/status/sessions'] = MOVIE;
  w.tick();
  assert.strictEqual(w.engine.status('any').plexOk, true);
});

test('a refused sign-in stops the polling and asks for setup again', function () {
  var routes = { '/status/sessions': { __error: { status: 401 } } };
  var w = world(routes);
  w.engine.start();
  w.tick();
  assert.strictEqual(w.engine.status('any').state, 'setup');
  assert.strictEqual(w.engine.isConfigured(), false);
  var before = w.calls.length;
  w.tick();
  assert.strictEqual(w.calls.length, before, 'no more requests');
});

test('a broken answer does not stop the loop', function () {
  var routes = { '/status/sessions': 'not json at all' };
  var w = world(routes);
  w.engine.start();
  w.tick();
  w.tick();
  assert.ok(w.calls.length >= 3);
  assert.strictEqual(w.engine.status('any').state, 'idle');
});

test('signOut forgets the saved server', function () {
  var w = world({ '/status/sessions': MOVIE });
  w.engine.signOut();
  assert.strictEqual(w.engine.isConfigured(), false);
  assert.strictEqual(w.engine.status('any').state, 'setup');
});
