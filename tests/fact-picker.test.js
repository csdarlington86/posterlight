'use strict';
var test = require('node:test');
var assert = require('node:assert');
var picker = require('../lib/fact-picker');

function numbered(n) { var o = []; for (var i = 0; i < n; i++) o.push('Fact ' + i); return o; }
function unique(list) { var s = {}; list.forEach(function (x) { s[x] = 1; }); return Object.keys(s).length; }

test('movie picks: up to 15, no repeats, same order for the same movie', function () {
  var a = picker.pickMovieFacts(numbered(20), '101');
  assert.strictEqual(a.length, 15);
  assert.strictEqual(unique(a), 15);
  assert.deepStrictEqual(picker.pickMovieFacts(numbered(20), '101'), a);
  assert.notDeepStrictEqual(picker.pickMovieFacts(numbered(20), '102'), a);
  assert.strictEqual(picker.pickMovieFacts(numbered(4), '101').length, 4);
});

test('episode picks without stored state: 3 facts, the same on every device', function () {
  var pool = numbered(12);
  var a = picker.pickEpisodeFactsStateless(pool, 'breaking-bad', 1, 1);
  assert.strictEqual(a.length, 3);
  assert.strictEqual(unique(a), 3);
  assert.deepStrictEqual(picker.pickEpisodeFactsStateless(pool, 'breaking-bad', 1, 1), a);
});

test('episode picks: episodes that follow each other do not reuse a fact until the pool runs out', function () {
  var pool = numbered(12);
  var all = [];
  for (var e = 1; e <= 4; e++) all = all.concat(picker.pickEpisodeFactsStateless(pool, 'breaking-bad', 1, e));
  assert.strictEqual(unique(all), 12);
});

test('episode picks survive small pools and missing numbers', function () {
  assert.strictEqual(picker.pickEpisodeFactsStateless(numbered(2), 'x', 1, 1).length, 2);
  assert.strictEqual(picker.pickEpisodeFactsStateless(numbered(7), 'x', null, null).length, 3);
  assert.deepStrictEqual(picker.pickEpisodeFactsStateless([], 'x', 1, 1), []);
  assert.strictEqual(unique(picker.pickEpisodeFactsStateless(numbered(4), 'x', 3, 9)), 3);
});
