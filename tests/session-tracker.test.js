'use strict';
var test = require('node:test');
var assert = require('node:assert');
var createTracker = require('../lib/session-tracker').createTracker;

function session(over) {
  var s = {
    playerId: 'abc', playerName: 'Living Room', playerState: 'playing', type: 'movie',
    ratingKey: '101', title: 'Alien', durationMs: 7020000, viewOffsetMs: 60000, cast: [], directors: []
  };
  Object.keys(over || {}).forEach(function (k) { s[k] = over[k]; });
  return s;
}

function setup() {
  var clock = { t: 1000000 };
  var tracker = createTracker({ now: function () { return clock.t; }, pauseGraceMs: 10000, fullBrightMs: 180000 });
  return { clock: clock, tracker: tracker };
}

test('idle before any update', function () {
  var v = setup().tracker.view('abc');
  assert.strictEqual(v.state, 'idle');
  assert.strictEqual(v.session, null);
  assert.strictEqual(v.brightness, 'dim');
});

test('playing session is full brightness for the first 3 minutes, then dim', function () {
  var s = setup();
  s.tracker.update([session()]);
  assert.strictEqual(s.tracker.view('abc').state, 'playing');
  assert.strictEqual(s.tracker.view('abc').brightness, 'full');
  s.clock.t += 179999;
  s.tracker.update([session()]);
  assert.strictEqual(s.tracker.view('abc').brightness, 'full');
  s.clock.t += 1;
  assert.strictEqual(s.tracker.view('abc').brightness, 'dim');
});

test('offset extrapolates between Plex updates while playing', function () {
  var s = setup();
  s.tracker.update([session()]);
  s.clock.t += 5000;
  s.tracker.update([session()]);
  assert.strictEqual(s.tracker.view('abc').offsetMs, 65000);
  s.clock.t += 1000;
  assert.strictEqual(s.tracker.view('abc').offsetMs, 66000);
});

test('a new reported offset replaces the estimate', function () {
  var s = setup();
  s.tracker.update([session()]);
  s.clock.t += 5000;
  s.tracker.update([session({ viewOffsetMs: 900000 })]);
  assert.strictEqual(s.tracker.view('abc').offsetMs, 900000);
});

test('offset never exceeds the duration', function () {
  var s = setup();
  s.tracker.update([session({ viewOffsetMs: 7019000 })]);
  s.clock.t += 60000;
  s.tracker.update([session({ viewOffsetMs: 7019000 })]);
  assert.strictEqual(s.tracker.view('abc').offsetMs, 7020000);
});

test('paused under 10 seconds still shows playing; at 10 seconds it is intermission', function () {
  var s = setup();
  s.tracker.update([session()]);
  var startedAt = s.tracker.view('abc').startedAt;
  s.clock.t += 2000;
  s.tracker.update([session({ playerState: 'paused', viewOffsetMs: 62000 })]);
  s.clock.t += 9999;
  s.tracker.update([session({ playerState: 'paused', viewOffsetMs: 62000 })]);
  assert.strictEqual(s.tracker.view('abc').state, 'playing');
  s.clock.t += 1;
  assert.strictEqual(s.tracker.view('abc').state, 'intermission');
  assert.strictEqual(s.tracker.view('abc').offsetMs, 62000, 'paused offset does not advance');
  s.clock.t += 2000;
  s.tracker.update([session({ playerState: 'playing', viewOffsetMs: 62000 })]);
  assert.strictEqual(s.tracker.view('abc').state, 'playing');
  assert.strictEqual(s.tracker.view('abc').startedAt, startedAt);
});

test('buffering counts as playing', function () {
  var s = setup();
  s.tracker.update([session({ playerState: 'buffering' })]);
  s.clock.t += 20000;
  s.tracker.update([session({ playerState: 'buffering' })]);
  assert.strictEqual(s.tracker.view('abc').state, 'playing');
});

test('a new title on the same player restarts the full-brightness window', function () {
  var s = setup();
  s.tracker.update([session()]);
  s.clock.t += 200000;
  s.tracker.update([session()]);
  assert.strictEqual(s.tracker.view('abc').brightness, 'dim');
  s.tracker.update([session({ ratingKey: '102', title: 'Aliens', viewOffsetMs: 0 })]);
  var v = s.tracker.view('abc');
  assert.strictEqual(v.brightness, 'full');
  assert.strictEqual(v.startedAt, s.clock.t);
  assert.strictEqual(v.session.title, 'Aliens');
});

test('a session that disappears makes the player idle', function () {
  var s = setup();
  s.tracker.update([session()]);
  s.tracker.update([]);
  assert.strictEqual(s.tracker.view('abc').state, 'idle');
});

test('two players are tracked apart, and any prefers the playing one', function () {
  var s = setup();
  var b = { playerId: 'def', playerName: 'Bedroom', playerState: 'paused', ratingKey: '555', title: 'Ep' };
  s.tracker.update([session(b), session()]);
  s.clock.t += 10000;
  s.tracker.update([session(b), session({ viewOffsetMs: 70000 })]);
  assert.strictEqual(s.tracker.view('abc').state, 'playing');
  assert.strictEqual(s.tracker.view('def').state, 'intermission');
  assert.strictEqual(s.tracker.view('any').session.playerId, 'abc');
  assert.strictEqual(s.tracker.view('nobody').state, 'idle');
});

test('any follows a paused session when nothing else plays', function () {
  var s = setup();
  s.tracker.update([session({ playerState: 'paused' })]);
  assert.strictEqual(s.tracker.view('any').session.playerId, 'abc');
});

test('losing Plex keeps the last session and keeps the offset moving', function () {
  var s = setup();
  s.tracker.update([session()]);
  assert.strictEqual(s.tracker.view('abc').plexOk, true);
  s.clock.t += 4000;
  s.tracker.update(null);
  var v = s.tracker.view('abc');
  assert.strictEqual(v.state, 'playing');
  assert.strictEqual(v.plexOk, false);
  assert.strictEqual(v.offsetMs, 64000);
  s.tracker.update([session({ viewOffsetMs: 66000 })]);
  assert.strictEqual(s.tracker.view('abc').plexOk, true);
});

test('a held session goes idle once its estimated offset reaches the end', function () {
  var s = setup();
  s.tracker.update([session({ viewOffsetMs: 7000000 })]);
  s.tracker.update(null);
  s.clock.t += 19999;
  assert.strictEqual(s.tracker.view('abc').state, 'playing');
  s.clock.t += 1;
  assert.strictEqual(s.tracker.view('abc').state, 'idle');
});

test('players lists everyone seen, with an active flag', function () {
  var s = setup();
  s.tracker.loadPlayers([{ id: 'old', name: 'Old Tablet' }]);
  s.tracker.update([session()]);
  assert.deepStrictEqual(s.tracker.players(), [
    { id: 'abc', name: 'Living Room', active: true },
    { id: 'old', name: 'Old Tablet', active: false }
  ]);
  s.tracker.update([]);
  assert.strictEqual(s.tracker.players()[0].active, false);
});

test('a device may follow a player by its name', function () {
  var s = setup();
  s.tracker.update([session()]);
  assert.strictEqual(s.tracker.view('living room').state, 'playing');
  assert.strictEqual(s.tracker.view('Living Room').session.playerId, 'abc');
});

test('a small difference between Plex and the estimate does not move the offset backwards', function () {
  var s = setup();
  s.tracker.update([session({ viewOffsetMs: 60000 })]);
  s.clock.t += 10500;
  // Plex reports 70000 while the estimate is 70500: keep the estimate, so a fact does not flicker.
  s.tracker.update([session({ viewOffsetMs: 70000 })]);
  assert.strictEqual(s.tracker.view('abc').offsetMs, 70500);
  s.clock.t += 1000;
  assert.strictEqual(s.tracker.view('abc').offsetMs, 71500);
});

test('a seek of 5 seconds or more replaces the estimate', function () {
  var s = setup();
  s.tracker.update([session({ viewOffsetMs: 60000 })]);
  s.clock.t += 2000;
  s.tracker.update([session({ viewOffsetMs: 67000 })]);
  assert.strictEqual(s.tracker.view('abc').offsetMs, 67000);
  s.clock.t += 2000;
  s.tracker.update([session({ viewOffsetMs: 30000 })]);
  assert.strictEqual(s.tracker.view('abc').offsetMs, 30000);
});
