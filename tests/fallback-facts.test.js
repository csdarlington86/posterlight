'use strict';
var test = require('node:test');
var assert = require('node:assert');
var buildLibraryIndex = require('../lib/library-index').buildLibraryIndex;
var buildFallbackFacts = require('../lib/fallback-facts').buildFallbackFacts;

var library = buildLibraryIndex([
  { title: 'Alien', year: 1979, type: 'movie', directors: ['Ridley Scott'], cast: ['Sigourney Weaver', 'Tom Skerritt'] },
  { title: 'Blade Runner', year: 1982, type: 'movie', directors: ['Ridley Scott'], cast: ['Harrison Ford'] },
  { title: 'Gladiator', year: 2000, type: 'movie', directors: ['Ridley Scott'], cast: ['Russell Crowe'] },
  { title: 'The Martian', year: 2015, type: 'movie', directors: ['Ridley Scott'], cast: ['Matt Damon'] },
  { title: 'Thelma & Louise', year: 1991, type: 'movie', directors: ['Ridley Scott'], cast: ['Susan Sarandon'] },
  { title: 'Ghostbusters', year: 1984, type: 'movie', directors: ['Ivan Reitman'], cast: ['Bill Murray', 'Sigourney Weaver'] },
  { title: 'Aliens', year: 1986, type: 'movie', directors: ['James Cameron'], cast: ['Sigourney Weaver'] }
]);

var movie = {
  type: 'movie', title: 'Alien', year: 1979, studio: '20th Century Fox',
  directors: ['Ridley Scott'],
  cast: [
    { name: 'Sigourney Weaver', role: 'Ripley' },
    { name: 'Tom Skerritt', role: 'Dallas' },
    { name: 'John Hurt', role: null }
  ]
};

test('library index finds other titles, up to 3, sorted, without the current title', function () {
  assert.deepStrictEqual(library.otherByDirector('Ridley Scott', 'Alien'), ['Blade Runner', 'Gladiator', 'The Martian']);
  assert.deepStrictEqual(library.otherByActor('Sigourney Weaver', 'Alien'), ['Aliens', 'Ghostbusters']);
  assert.deepStrictEqual(library.otherByActor('Nobody', 'Alien'), []);
  assert.deepStrictEqual(library.otherByDirector('ridley scott', 'alien').length, 3);
});

test('a full movie session gives every sentence in order', function () {
  assert.deepStrictEqual(buildFallbackFacts(movie, library), [
    'Alien was released in 1979.',
    'Directed by Ridley Scott.',
    'Ridley Scott also directed Blade Runner, Gladiator and The Martian in your library.',
    'A 20th Century Fox production.',
    'Sigourney Weaver plays Ripley.',
    'Tom Skerritt plays Dallas.',
    'You can also see Sigourney Weaver in Aliens and Ghostbusters in your library.'
  ]);
});

test('director lists read naturally', function () {
  var two = buildFallbackFacts({ type: 'movie', title: 'X', directors: ['A', 'B'], cast: [] }, null);
  assert.deepStrictEqual(two, ['Directed by A and B.']);
  var three = buildFallbackFacts({ type: 'movie', title: 'X', directors: ['A', 'B', 'C'], cast: [] }, null);
  assert.deepStrictEqual(three, ['Directed by A, B and C.']);
});

test('a session with only a title gives no facts', function () {
  assert.deepStrictEqual(buildFallbackFacts({ type: 'movie', title: 'X', directors: [], cast: [] }, library), []);
});

test('an empty or missing index gives no library sentences', function () {
  var facts = buildFallbackFacts(movie, buildLibraryIndex([]));
  assert.strictEqual(facts.filter(function (f) { return /your library/.test(f); }).length, 0);
  assert.strictEqual(buildFallbackFacts(movie, null).length, 5);
});

test('only the first 5 cast members are used', function () {
  var cast = [];
  for (var i = 0; i < 9; i++) cast.push({ name: 'Actor ' + i, role: 'Role ' + i });
  var facts = buildFallbackFacts({ type: 'movie', title: 'X', directors: [], cast: cast }, null);
  assert.strictEqual(facts.length, 5);
});

test('episodes add the season and episode sentence and use the show for library lookups', function () {
  var facts = buildFallbackFacts({
    type: 'episode', title: 'The You You Are', showTitle: 'Severance', seasonNumber: 1, episodeNumber: 4,
    year: 2022, directors: [], cast: []
  }, library);
  assert.deepStrictEqual(facts, ['This episode first aired in 2022.', 'This is season 1, episode 4 of Severance.']);
});

test('tracks give no facts', function () {
  assert.deepStrictEqual(buildFallbackFacts({ type: 'track', title: 'So What', year: 1959, directors: [], cast: [] }, library), []);
});
