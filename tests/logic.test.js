'use strict';
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var L = require('../public/js/logic.js');

var CAST = [{ name: 'A', role: 'B', imgId: null }];
function status(over) {
  var s = {
    plexOk: true, player: { id: 'abc', name: 'TV' }, state: 'playing', brightness: 'dim',
    media: { type: 'movie', title: 'Alien', posterShape: 'portrait', cast: CAST }
  };
  Object.keys(over || {}).forEach(function (k) { s[k] = over[k]; });
  return s;
}
function ctx(over) {
  var c = { nowMs: 1000000, lastTapMs: 0, hasPlayer: true };
  Object.keys(over || {}).forEach(function (k) { c[k] = over[k]; });
  return c;
}

test('screen: setup when no player is chosen', function () {
  assert.strictEqual(L.computeView(status(), ctx({ hasPlayer: false })).screen, 'setup');
});

test('a helper that is not set up yet shows the unconfigured screen', function () {
  var v = L.computeView({ state: 'setup', media: null }, ctx({ hasPlayer: false }));
  assert.deepStrictEqual(v, { screen: 'unconfigured', card: 'hidden', sign: 'Now Showing' });
  assert.strictEqual(L.computeView({ state: 'setup' }, ctx()).screen, 'unconfigured');
});

test('screen: idle with no status or an idle status', function () {
  assert.strictEqual(L.computeView(null, ctx()).screen, 'idle');
  assert.strictEqual(L.computeView(status({ state: 'idle', media: null }), ctx()).screen, 'idle');
  assert.strictEqual(L.computeView(status({ media: null }), ctx()).screen, 'idle');
});

test('screen: intermission and now', function () {
  assert.strictEqual(L.computeView(status({ state: 'intermission' }), ctx()).screen, 'intermission');
  assert.strictEqual(L.computeView(status(), ctx()).screen, 'now');
});

test('a playing movie shows the cast, with no dimming', function () {
  assert.deepStrictEqual(L.computeView(status(), ctx()), { screen: 'now', card: 'cast', sign: 'Now Showing' });
});

test('an idle status with a library poster shows it under a Coming Soon sign', function () {
  var s = status({ state: 'idle', player: null });
  s.media = { type: 'movie', title: 'Heat', posterShape: 'portrait', cast: [] };
  assert.deepStrictEqual(L.computeView(s, ctx()), { screen: 'now', card: 'hidden', sign: 'Coming Soon' });
});

test('the poster fits a measured box', function () {
  var l = L.computeLayout(375, 812, 'portrait', { w: 300, h: 240 });
  assert.strictEqual(l.posterH, 240);
  assert.strictEqual(l.posterW, 160);
  assert.strictEqual(L.computeLayout(375, 812, 'square', { w: 200, h: 240 }).posterW, 200);
});

test('the corner buttons hide after 10 seconds', function () {
  assert.strictEqual(L.CONTROLS_MS, 10000);
});

test('no cast hides the card', function () {
  var s = status({ brightness: 'full' });
  s.media = { type: 'movie', title: 'X', posterShape: 'portrait', cast: [] };
  assert.strictEqual(L.computeView(s, ctx()).card, 'hidden');
});

test('music never shows the card', function () {
  var s = status({ brightness: 'full' });
  s.media = { type: 'track', title: 'Song', posterShape: 'square', cast: [] };
  assert.strictEqual(L.computeView(s, ctx()).card, 'hidden');
});

test('intermission and idle hide the card', function () {
  assert.deepStrictEqual(L.computeView(status({ state: 'intermission' }), ctx()), { screen: 'intermission', card: 'hidden', sign: 'Now Showing' });
  assert.strictEqual(L.computeView(null, ctx()).card, 'hidden');
});

var SIZES = [[768, 1024], [1024, 768], [800, 1280], [1280, 800], [390, 844], [844, 390], [360, 800], [800, 360]];

test('the poster keeps a 2:3 shape and fits its box at every target size', function () {
  SIZES.forEach(function (s) {
    var w = s[0], h = s[1];
    var lay = L.computeLayout(w, h, 'portrait');
    var label = w + 'x' + h;
    assert.strictEqual(lay.orientation, w > h ? 'landscape' : 'portrait', label);
    assert.ok(Math.abs(lay.posterW / lay.posterH - 2 / 3) < 0.01, label + ' ratio ' + lay.posterW + 'x' + lay.posterH);
    assert.strictEqual(lay.posterW, Math.round(lay.posterW), label);
    assert.strictEqual(lay.posterH, Math.round(lay.posterH), label);
    if (w > h) {
      assert.ok(lay.posterW <= 0.42 * w + 1 && lay.posterH <= 0.84 * h + 1, label);
    } else {
      assert.ok(lay.posterW <= 0.86 * w + 1 && lay.posterH <= 0.52 * h + 1, label);
    }
    assert.ok(lay.posterH >= 0.3 * h, label + ' poster is not tiny');
    assert.ok(lay.castCount >= 3 && lay.castCount <= 8, label);
    assert.ok(lay.baseFont >= 15 && lay.baseFont <= 26, label);
  });
});

test('square art stays square', function () {
  SIZES.forEach(function (s) {
    var lay = L.computeLayout(s[0], s[1], 'square');
    assert.strictEqual(lay.posterW, lay.posterH);
  });
});

test('phones show fewer headshots than tablets', function () {
  assert.ok(L.computeLayout(390, 844, 'portrait').castCount < L.computeLayout(768, 1024, 'portrait').castCount);
  assert.ok(L.computeLayout(360, 800, 'portrait').castCount < L.computeLayout(800, 1280, 'portrait').castCount);
});

test('tablets get larger text than phones', function () {
  assert.ok(L.computeLayout(768, 1024, 'portrait').baseFont > L.computeLayout(390, 844, 'portrait').baseFont);
});

test('layout survives a zero-size window', function () {
  var lay = L.computeLayout(0, 0, 'portrait');
  assert.ok(lay.posterW >= 1 && lay.posterH >= 1);
});

test('pickPlayer: the URL wins over the stored choice', function () {
  assert.strictEqual(L.pickPlayer('?player=abc', 'def'), 'abc');
  assert.strictEqual(L.pickPlayer('?demo=tv&player=Living%20Room', null), 'Living Room');
  assert.strictEqual(L.pickPlayer('', 'def'), 'def');
  assert.strictEqual(L.pickPlayer('', null), null);
  assert.strictEqual(L.pickPlayer('?player=', 'def'), 'def');
  assert.strictEqual(L.pickPlayer('?player=%E0%A4%A', 'def'), 'def');
});

test('queryParam reads one value', function () {
  assert.strictEqual(L.queryParam('?demo=tv&player=x', 'demo'), 'tv');
  assert.strictEqual(L.queryParam('?a=1', 'demo'), null);
});

test('imageSize rounds up to 100 and caps the pixel ratio at 2', function () {
  assert.strictEqual(L.imageSize(384, 2), 800);
  assert.strictEqual(L.imageSize(384, 3), 800);
  assert.strictEqual(L.imageSize(384, undefined), 400);
});

test('formatRuntime reads like a marquee', function () {
  assert.strictEqual(L.formatRuntime(117), '1h 57m');
  assert.strictEqual(L.formatRuntime(120), '2h');
  assert.strictEqual(L.formatRuntime(48), '48m');
  assert.strictEqual(L.formatRuntime(0), '');
});

test('initials come from the first and last name', function () {
  assert.strictEqual(L.initials('Sigourney Weaver'), 'SW');
  assert.strictEqual(L.initials('Cher'), 'C');
  assert.strictEqual(L.initials(''), '');
});

test('logic.js is ES5', function () {
  var text = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'logic.js'), 'utf8');
  assert.ok(!/=>|\blet\b|\bconst\b|\?\.|\?\?|`/.test(text));
});
