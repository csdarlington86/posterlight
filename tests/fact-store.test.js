'use strict';
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var createFactStore = require('../lib/fact-store').createFactStore;

function setup() {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-facts-'));
  fs.mkdirSync(path.join(dir, 'facts', 'movies'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'facts', 'shows'), { recursive: true });
  var opts = { factsDir: path.join(dir, 'facts'), statePath: path.join(dir, 'data', 'fact-state.json'), warn: function () {} };
  return { dir: dir, opts: opts, store: createFactStore(opts) };
}

function numbered(n, prefix) {
  var out = [];
  for (var i = 0; i < n; i++) out.push((prefix || 'Fact ') + i);
  return out;
}

function write(s, rel, obj) {
  fs.writeFileSync(path.join(s.dir, 'facts', rel), typeof obj === 'string' ? obj : JSON.stringify(obj));
}

function unique(list) {
  var seen = {};
  list.forEach(function (x) { seen[x] = true; });
  return Object.keys(seen).length;
}

var movie = { type: 'movie', ratingKey: '101', title: 'Alien', year: 1979 };
function episode(key) { return { type: 'episode', ratingKey: key, title: 'Ep ' + key, showTitle: 'Severance', year: 2022 }; }

test('a movie with 20 facts gets 15, all different, same order each time', function () {
  var s = setup();
  var facts = numbered(20);
  write(s, 'movies/alien-1979.json', { title: 'Alien', year: 1979, facts: facts });
  var a = s.store.factsFor(movie);
  assert.strictEqual(a.length, 15);
  assert.strictEqual(unique(a), 15);
  a.forEach(function (f) { assert.ok(facts.indexOf(f) !== -1); });
  assert.deepStrictEqual(s.store.factsFor(movie), a);
  assert.deepStrictEqual(createFactStore(s.opts).factsFor(movie), a);
  assert.notDeepStrictEqual(a, facts.slice(0, 15), 'the order is shuffled');
});

test('a movie with 6 facts gets all 6', function () {
  var s = setup();
  write(s, 'movies/alien-1979.json', { title: 'Alien', year: 1979, facts: numbered(6) });
  assert.strictEqual(s.store.factsFor(movie).length, 6);
});

test('no file gives null', function () {
  assert.strictEqual(setup().store.factsFor(movie), null);
});

test('blank and non-string facts are dropped', function () {
  var s = setup();
  write(s, 'movies/alien-1979.json', { title: 'Alien', facts: ['Real', '', '   ', 5, null, 'Also real'] });
  assert.deepStrictEqual(s.store.factsFor(movie).slice().sort(), ['Also real', 'Real']);
});

test('a file with no usable facts gives null', function () {
  var s = setup();
  write(s, 'movies/alien-1979.json', { title: 'Alien', facts: [] });
  assert.strictEqual(s.store.factsFor(movie), null);
});

test('episodes draw 3 facts each from the show pool with no reuse until it runs out', function () {
  var s = setup();
  write(s, 'shows/severance.json', { title: 'Severance', facts: numbered(7) });
  var a = s.store.factsFor(episode('A'));
  var b = s.store.factsFor(episode('B'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(b.length, 3);
  assert.strictEqual(unique(a.concat(b)), 6);
  var c = s.store.factsFor(episode('C'));
  assert.strictEqual(c.length, 3);
  assert.strictEqual(unique(c), 3);
  var leftover = numbered(7).filter(function (f) { return a.concat(b).indexOf(f) === -1; })[0];
  assert.ok(c.indexOf(leftover) !== -1, 'the one unused fact is used before the pool resets');
});

test('an episode seen before gets the same facts, also after a restart', function () {
  var s = setup();
  write(s, 'shows/severance.json', { title: 'Severance', facts: numbered(12) });
  var a = s.store.factsFor(episode('A'));
  s.store.factsFor(episode('B'));
  assert.deepStrictEqual(s.store.factsFor(episode('A')), a);
  assert.deepStrictEqual(createFactStore(s.opts).factsFor(episode('A')), a);
});

test('a show pool smaller than 3 gives what it has', function () {
  var s = setup();
  write(s, 'shows/severance.json', { title: 'Severance', facts: numbered(2) });
  assert.strictEqual(s.store.factsFor(episode('A')).length, 2);
});

test('invalid JSON counts as no file', function () {
  var s = setup();
  write(s, 'movies/alien-1979.json', '{ not json');
  assert.strictEqual(s.store.factsFor(movie), null);
});

test('a damaged state file does not stop episode facts', function () {
  var s = setup();
  write(s, 'shows/severance.json', { title: 'Severance', facts: numbered(7) });
  fs.mkdirSync(path.dirname(s.opts.statePath), { recursive: true });
  fs.writeFileSync(s.opts.statePath, 'garbage');
  assert.strictEqual(createFactStore(s.opts).factsFor(episode('A')).length, 3);
});

test('tracks get null', function () {
  assert.strictEqual(setup().store.factsFor({ type: 'track', ratingKey: '9', title: 'So What' }), null);
});

test('a movie with no year matches a file with no year in its name', function () {
  var s = setup();
  write(s, 'movies/alien.json', { title: 'Alien', facts: numbered(3) });
  assert.strictEqual(s.store.factsFor({ type: 'movie', ratingKey: '1', title: 'Alien', year: null }).length, 3);
});
