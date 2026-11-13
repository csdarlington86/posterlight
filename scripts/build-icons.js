'use strict';
// Draws the PosterLight logo and writes it as an SVG and as PNG icons.
// The logo is one list of shapes on a 512 x 512 grid. The SVG and the PNGs both come
// from that list, so they always match. No dependencies: run with `npm run icons`.
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var BG = '#14110F';
var AMBER = '#FFC857';
var BRIGHT = '#FFE9A8';
var DIM = '#7A5C1E';

var SIZES = {
  'icon-120.png': 120, 'icon-152.png': 152, 'icon-167.png': 167, 'icon-180.png': 180,
  'icon-192.png': 192, 'icon-512.png': 512, 'icon-maskable-512.png': 512, 'favicon-32.png': 32
};

function bulbs() {
  // 20 bulbs on a ring around the poster, listed clockwise so bright and dim alternate.
  var left = 118, right = 394, top = 66, bottom = 446;
  var points = [];
  var i;
  for (i = 0; i < 5; i++) points.push([left + i * (right - left) / 4, top]);
  for (i = 1; i <= 5; i++) points.push([right, top + i * (bottom - top) / 6]);
  for (i = 0; i < 5; i++) points.push([right - i * (right - left) / 4, bottom]);
  for (i = 5; i >= 1; i--) points.push([left, top + i * (bottom - top) / 6]);
  var shapes = [];
  points.forEach(function (p, n) {
    var bright = n % 2 === 0;
    if (bright) shapes.push({ kind: 'circle', cx: p[0], cy: p[1], r: 21, fill: BRIGHT, alpha: 0.22 });
    shapes.push({ kind: 'circle', cx: p[0], cy: p[1], r: 12.5, fill: bright ? BRIGHT : DIM, alpha: 1, bulb: true });
  });
  return shapes;
}

function logoShapes() {
  return [
    // the poster
    { kind: 'rect', x: 152, y: 100, w: 208, h: 312, r: 14, fill: AMBER, alpha: 1 },
    // the letter P: a stem, a rounded bowl, and the hole in the bowl
    { kind: 'rect', x: 206, y: 176, w: 34, h: 164, r: 0, fill: BG, alpha: 1 },
    { kind: 'rect', x: 206, y: 176, w: 106, h: 100, r: 50, fill: BG, alpha: 1 },
    { kind: 'rect', x: 206, y: 176, w: 50, h: 100, r: 0, fill: BG, alpha: 1 },
    { kind: 'rect', x: 240, y: 208, w: 40, h: 36, r: 18, fill: AMBER, alpha: 1 }
  ].concat(bulbs());
}

function rgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function inside(s, x, y) {
  if (s.kind === 'circle') {
    var dx = x - s.cx, dy = y - s.cy;
    return dx * dx + dy * dy <= s.r * s.r;
  }
  if (x < s.x || x > s.x + s.w || y < s.y || y > s.y + s.h) return false;
  if (!s.r) return true;
  var cx = Math.max(s.x + s.r, Math.min(s.x + s.w - s.r, x));
  var cy = Math.max(s.y + s.r, Math.min(s.y + s.h - s.r, y));
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= s.r * s.r;
}

// Returns RGBA pixels. `scale` shrinks the art around the centre (used for maskable icons).
function render(size, scale) {
  var shapes = logoShapes().map(function (s) { return { s: s, c: rgb(s.fill) }; });
  var bg = rgb(BG);
  var out = Buffer.alloc(size * size * 4);
  var SS = 4;
  for (var py = 0; py < size; py++) {
    for (var px = 0; px < size; px++) {
      var r = 0, g = 0, b = 0;
      for (var sy = 0; sy < SS; sy++) {
        for (var sx = 0; sx < SS; sx++) {
          // sample position on the 512 grid
          var gx = ((px + (sx + 0.5) / SS) / size * 512 - 256) / scale + 256;
          var gy = ((py + (sy + 0.5) / SS) / size * 512 - 256) / scale + 256;
          var cr = bg[0], cg = bg[1], cb = bg[2];
          for (var k = 0; k < shapes.length; k++) {
            var sh = shapes[k];
            if (inside(sh.s, gx, gy)) {
              var a = sh.s.alpha;
              cr = cr * (1 - a) + sh.c[0] * a;
              cg = cg * (1 - a) + sh.c[1] * a;
              cb = cb * (1 - a) + sh.c[2] * a;
            }
          }
          r += cr; g += cg; b += cb;
        }
      }
      var n = SS * SS;
      var o = (py * size + px) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = 255;
    }
  }
  return out;
}

var CRC_TABLE = (function () {
  var table = [];
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf) {
  var c = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  var head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  var crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.slice(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function encodePng(pixels, size) {
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  var rows = Buffer.alloc((size * 4 + 1) * size);
  for (var y = 0; y < size; y++) {
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function svg() {
  var body = logoShapes().map(function (s) {
    var alpha = s.alpha < 1 ? ' fill-opacity="' + s.alpha + '"' : '';
    if (s.kind === 'circle') {
      return '  <circle' + (s.bulb ? ' class="bulb"' : '') + ' cx="' + s.cx + '" cy="' + s.cy.toFixed(2).replace(/\.00$/, '') +
        '" r="' + s.r + '" fill="' + s.fill + '"' + alpha + '/>';
    }
    return '  <rect x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '"' +
      (s.r ? ' rx="' + s.r + '"' : '') + ' fill="' + s.fill + '"' + alpha + '/>';
  }).join('\n');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="PosterLight">\n' +
    '  <rect width="512" height="512" rx="96" fill="' + BG + '"/>\n' + body + '\n</svg>\n';
}

function build(outDir, options) {
  var sizes = (options && options.sizes) || SIZES;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'logo.svg'), svg());
  Object.keys(sizes).forEach(function (name) {
    var size = sizes[name];
    // Android may crop a maskable icon to a circle, so its art stays inside the safe zone.
    var scale = name.indexOf('maskable') !== -1 ? 0.7 : 1;
    fs.writeFileSync(path.join(outDir, name), encodePng(render(size, scale), size));
  });
}

module.exports = { build: build, render: render, SIZES: SIZES };

if (require.main === module) {
  var target = path.join(__dirname, '..', 'public', 'icons');
  build(target);
  console.log('Icons written to ' + target);
}
