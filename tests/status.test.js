'use strict';
var test = require('node:test');
var assert = require('node:assert');
var buildStatus = require('../lib/status').buildStatus;
var createImageRegistry = require('../lib/image-registry').createImageRegistry;

function movieSession() {
  return {
    playerId: 'abc', playerName: 'Living Room', playerState: 'playing', type: 'movie', ratingKey: '101',
    title: 'Alien', year: 1979, contentRating: 'R', durationMs: 7200000, viewOffsetMs: 0,
    studio: 'Fox', directors: ['Ridley Scott'],
    cast: [{ name: 'Sigourney Weaver', role: 'Ripley', thumb: 'https://metadata-static.plex.tv/people/weaver.jpg' },
           { name: 'John Hurt', role: 'Kane', thumb: null }],
    posterPath: '/library/metadata/101/thumb/1'
  };
}

function view(over) {
  var v = { plexOk: true, state: 'playing', brightness: 'full', session: movieSession(), offsetMs: 0, startedAt: 0 };
  Object.keys(over || {}).forEach(function (k) { v[k] = over[k]; });
  return v;
}

function deps(over) {
  var d = {
    images: createImageRegistry()
  };
  Object.keys(over || {}).forEach(function (k) { d[k] = over[k]; });
  return d;
}

test('media fields are filled for a movie', function () {
  var d = deps();
  var m = buildStatus(view(), d).media;
  assert.strictEqual(m.type, 'movie');
  assert.strictEqual(m.title, 'Alien');
  assert.strictEqual(m.subtitle, '');
  assert.strictEqual(m.year, 1979);
  assert.strictEqual(m.rating, 'R');
  assert.strictEqual(m.runtimeMin, 120);
  assert.strictEqual(m.posterShape, 'portrait');
  assert.strictEqual(d.images.sourceFor(m.posterId), '/library/metadata/101/thumb/1');
  assert.strictEqual(m.cast.length, 2);
  assert.strictEqual(m.cast[0].name, 'Sigourney Weaver');
  assert.strictEqual(m.cast[0].role, 'Ripley');
  assert.strictEqual(d.images.sourceFor(m.cast[0].imgId), 'https://metadata-static.plex.tv/people/weaver.jpg');
  assert.strictEqual(m.cast[1].imgId, null);
});

test('a track has square art, no cast, and an artist subtitle', function () {
  var session = movieSession();
  session.type = 'track'; session.artist = 'Miles Davis'; session.album = 'Kind of Blue'; session.cast = [];
  var s = buildStatus(view({ session: session, offsetMs: 450000 }), deps());
  assert.strictEqual(s.media.posterShape, 'square');
  assert.deepStrictEqual(s.media.cast, []);
  assert.strictEqual(s.media.subtitle, 'Miles Davis · Kind of Blue');
});

test('an episode shows the show as title', function () {
  var session = movieSession();
  session.type = 'episode'; session.title = 'The You You Are'; session.showTitle = 'Severance';
  session.seasonNumber = 2; session.episodeNumber = 5; session.durationMs = 1800000;
  var s = buildStatus(view({ session: session, offsetMs: 900000 }), deps());
  assert.strictEqual(s.media.title, 'Severance');
  assert.strictEqual(s.media.subtitle, 'S2 · E5 · The You You Are');
});

test('an idle view has no media', function () {
  var s = buildStatus({ plexOk: true, state: 'idle', brightness: 'dim', session: null, offsetMs: 0, startedAt: null }, deps());
  assert.deepStrictEqual(s, { plexOk: true, player: null, state: 'idle', brightness: 'dim', media: null });
});

test('castFor replaces the session cast, and the cast is capped at 8', function () {
  var big = [];
  for (var i = 0; i < 12; i++) big.push({ name: 'Actor ' + i, role: 'Role', thumb: null });
  var s = buildStatus(view(), deps({ castFor: function () { return big; } }));
  assert.strictEqual(s.media.cast.length, 8);
  assert.strictEqual(s.media.cast[0].name, 'Actor 0');
});

test('the status never carries a Plex path, a source URL, or a token', function () {
  var text = JSON.stringify(buildStatus(view({ offsetMs: 450000 }), deps()));
  assert.ok(text.indexOf('/library/') === -1);
  assert.ok(text.indexOf('plex.tv') === -1);
  assert.ok(text.indexOf('thumb') === -1);
  assert.ok(text.indexOf('X-Plex-Token') === -1);
});
