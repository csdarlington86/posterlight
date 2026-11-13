'use strict';
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var icons = require('../scripts/build-icons');

var EXPECTED = {
  'icon-120.png': 120, 'icon-152.png': 152, 'icon-167.png': 167, 'icon-180.png': 180,
  'icon-192.png': 192, 'icon-512.png': 512, 'icon-maskable-512.png': 512, 'favicon-32.png': 32
};

test('build writes the logo SVG and every PNG size', function () {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-icons-'));
  icons.build(dir, { sizes: { 'icon-120.png': 120, 'favicon-32.png': 32, 'icon-maskable-512.png': 64 } });
  var svg = fs.readFileSync(path.join(dir, 'logo.svg'), 'utf8');
  assert.ok(svg.indexOf('#FFC857') !== -1);
  assert.ok(svg.indexOf('#FFE9A8') !== -1 && svg.indexOf('#7A5C1E') !== -1);
  assert.strictEqual(svg.split('class="bulb"').length - 1, 20);
  var png = fs.readFileSync(path.join(dir, 'icon-120.png'));
  assert.deepStrictEqual(Array.prototype.slice.call(png, 0, 8), [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.strictEqual(png.readUInt32BE(16), 120);
  assert.strictEqual(png.readUInt32BE(20), 120);
});

test('the default size list covers iOS and Android', function () {
  assert.deepStrictEqual(icons.SIZES, EXPECTED);
});

test('the committed icons exist at their named sizes', function () {
  Object.keys(EXPECTED).forEach(function (name) {
    var png = fs.readFileSync(path.join(__dirname, '..', 'public', 'icons', name));
    assert.strictEqual(png.readUInt32BE(16), EXPECTED[name], name);
    assert.strictEqual(png.readUInt32BE(20), EXPECTED[name], name);
  });
});

test('the icon centre is amber poster and the corner is the dark background', function () {
  var px = icons.render(64, 1);
  function at(x, y) { var i = (y * 64 + x) * 4; return [px[i], px[i + 1], px[i + 2]]; }
  assert.deepStrictEqual(at(1, 1), [0x14, 0x11, 0x0F]);
  assert.deepStrictEqual(at(40, 50), [0xFF, 0xC8, 0x57]);
});
