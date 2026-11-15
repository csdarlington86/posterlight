'use strict';
var test = require('node:test');
var assert = require('node:assert');
var parser = require('../lib/plex-parser');

function fixture(name) {
  return JSON.parse(JSON.stringify(require('./fixtures/' + name + '.json')));
}

test('movie session is normalized', function () {
  var list = parser.parseSessions(fixture('sessions-movie'));
  assert.strictEqual(list.length, 1);
  var s = list[0];
  assert.strictEqual(s.type, 'movie');
  assert.strictEqual(s.title, 'Alien');
  assert.strictEqual(s.year, 1979);
  assert.strictEqual(s.contentRating, 'R');
  assert.strictEqual(s.durationMs, 7020000);
  assert.strictEqual(s.viewOffsetMs, 60000);
  assert.strictEqual(s.playerId, 'abc');
  assert.strictEqual(s.playerName, 'Living Room');
  assert.strictEqual(s.playerState, 'playing');
  assert.strictEqual(s.ratingKey, '101');
  assert.strictEqual(s.studio, '20th Century Fox');
  assert.deepStrictEqual(s.directors, ['Ridley Scott']);
  assert.deepStrictEqual(s.cast[0], { name: 'Sigourney Weaver', role: 'Ripley', thumb: 'https://metadata-static.plex.tv/people/weaver.jpg' });
  assert.deepStrictEqual(s.cast[2], { name: 'John Hurt', role: 'Kane', thumb: null });
  assert.strictEqual(s.posterPath, '/library/metadata/101/thumb/1');
  assert.strictEqual(s.showTitle, null);
  assert.strictEqual(s.artist, null);
});

test('episode session carries show fields and season art', function () {
  var s = parser.parseSessions(fixture('sessions-episode'))[0];
  assert.strictEqual(s.type, 'episode');
  assert.strictEqual(s.showTitle, 'Severance');
  assert.strictEqual(s.seasonNumber, 1);
  assert.strictEqual(s.episodeNumber, 4);
  assert.strictEqual(s.showRatingKey, '500');
  assert.strictEqual(s.posterPath, '/library/metadata/510/thumb/1');
  assert.strictEqual(s.playerState, 'paused');
});

test('episode poster falls back to show art, then episode art', function () {
  var f = fixture('sessions-episode');
  delete f.MediaContainer.Metadata[0].parentThumb;
  assert.strictEqual(parser.parseSessions(f)[0].posterPath, '/library/metadata/500/thumb/1');
  delete f.MediaContainer.Metadata[0].grandparentThumb;
  assert.strictEqual(parser.parseSessions(f)[0].posterPath, '/library/metadata/555/thumb/1');
});

test('track session uses album art and has no cast', function () {
  var s = parser.parseSessions(fixture('sessions-track'))[0];
  assert.strictEqual(s.type, 'track');
  assert.strictEqual(s.artist, 'Miles Davis');
  assert.strictEqual(s.album, 'Kind of Blue');
  assert.strictEqual(s.posterPath, '/library/metadata/890/thumb/1');
  assert.deepStrictEqual(s.cast, []);
});

test('no Metadata key gives an empty list', function () {
  assert.deepStrictEqual(parser.parseSessions(fixture('sessions-empty')), []);
});

test('clips and sessions with no Player are dropped', function () {
  var list = parser.parseSessions(fixture('sessions-mixed'));
  assert.deepStrictEqual(list.map(function (s) { return s.playerId; }), ['abc', 'def']);
});

test('unexpected input gives an empty list and does not throw', function () {
  assert.deepStrictEqual(parser.parseSessions(null), []);
  assert.deepStrictEqual(parser.parseSessions({}), []);
  assert.deepStrictEqual(parser.parseSessions('<html>'), []);
  assert.deepStrictEqual(parser.parseSessions({ MediaContainer: { Metadata: 'x' } }), []);
  assert.deepStrictEqual(parser.parseSessions({ MediaContainer: { Metadata: [null, 5] } }), []);
});

test('missing viewOffset and duration become 0', function () {
  var f = fixture('sessions-movie');
  delete f.MediaContainer.Metadata[0].viewOffset;
  delete f.MediaContainer.Metadata[0].duration;
  var s = parser.parseSessions(f)[0];
  assert.strictEqual(s.viewOffsetMs, 0);
  assert.strictEqual(s.durationMs, 0);
});

test('an unknown player state counts as playing', function () {
  var f = fixture('sessions-movie');
  f.MediaContainer.Metadata[0].Player.state = 'weird';
  assert.strictEqual(parser.parseSessions(f)[0].playerState, 'playing');
});

test('parseCast reads the Role list of a metadata response', function () {
  var cast = parser.parseCast(fixture('sessions-movie'));
  assert.strictEqual(cast.length, 3);
  assert.strictEqual(cast[1].name, 'Tom Skerritt');
  assert.deepStrictEqual(parser.parseCast(null), []);
});

test('a title that is really a file name is tidied', function () {
  assert.strictEqual(parser.cleanTitle('Friday The 13th: Part 2 1981 SHOUT 1080p BluRay x265 5.1-RARBG'), 'Friday The 13th: Part 2');
  assert.strictEqual(parser.cleanTitle('Movie.Name.1999.720p.WEB-DL.x264'), 'Movie Name');
  assert.strictEqual(parser.cleanTitle('Blade Runner 2049'), 'Blade Runner 2049');
});

test('the Plex title is used; the file name is the fallback', function () {
  function one(m) {
    m.type = 'movie'; m.Player = { machineIdentifier: 'p1' };
    return parser.parseSessions({ MediaContainer: { Metadata: [m] } })[0].title;
  }
  var media = [{ Part: [{ file: '/films/Heat.1995.1080p.BluRay.x264-GRP.mkv' }] }];
  assert.strictEqual(one({ title: 'Heat', Media: media }), 'Heat');
  assert.strictEqual(one({ Media: media }), 'Heat');
  assert.strictEqual(one({ title: 'Heat 1995 1080p BluRay x264-GRP', Media: media }), 'Heat');
  assert.strictEqual(one({}), '');
});
