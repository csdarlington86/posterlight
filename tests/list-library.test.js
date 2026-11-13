'use strict';
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var lib = require('../scripts/list-library');

test('summarize names the fact file for each title and says if it exists', function () {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-lib-'));
  fs.mkdirSync(path.join(dir, 'movies'));
  fs.mkdirSync(path.join(dir, 'shows'));
  fs.writeFileSync(path.join(dir, 'movies', 'alien-1979.json'), '{"title":"Alien","facts":["x"]}');
  var out = lib.summarize([
    { type: 'movie', title: 'Alien', year: 1979 },
    { type: 'movie', title: 'WALL·E', year: 2008 },
    { type: 'movie', title: 'No Year', year: null },
    { type: 'show', title: 'Severance', year: 2022 },
    { type: 'artist', title: 'Miles Davis', year: null }
  ], dir);
  assert.deepStrictEqual(out.movies, [
    { title: 'Alien', year: 1979, file: 'facts/movies/alien-1979.json', hasFacts: true },
    { title: 'No Year', year: null, file: 'facts/movies/no-year.json', hasFacts: false },
    { title: 'WALL·E', year: 2008, file: 'facts/movies/wall-e-2008.json', hasFacts: false }
  ]);
  assert.deepStrictEqual(out.shows, [
    { title: 'Severance', year: 2022, file: 'facts/shows/severance.json', hasFacts: false }
  ]);
});

test('report lists counts and the missing files', function () {
  var text = lib.report({
    movies: [{ title: 'Alien', year: 1979, file: 'facts/movies/alien-1979.json', hasFacts: true },
             { title: 'Heat', year: 1995, file: 'facts/movies/heat-1995.json', hasFacts: false }],
    shows: []
  });
  assert.match(text, /Movies: 2 \(1 with facts\)/);
  assert.match(text, /Shows: 0 \(0 with facts\)/);
  assert.match(text, /Heat \(1995\)\s+facts\/movies\/heat-1995\.json/);
  assert.ok(text.indexOf('alien-1979') === -1);
});
