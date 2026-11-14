'use strict';
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var site = require('../scripts/build-site');

test('build writes a landing page and a demo that needs no helper', function () {
  var out = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-site-'));
  site.build(out);
  function read(rel) { return fs.readFileSync(path.join(out, rel), 'utf8'); }
  var landing = read('index.html');
  assert.match(landing, /PosterLight/);
  assert.match(landing, /href="demo\/"/);
  assert.match(landing, /not affiliated with/i);
  assert.ok(!/(src|href)="https?:\/\/(?!github\.com\/csdarlington86\/posterlight|nodejs\.org)/.test(landing), 'no third-party assets');
  assert.ok(fs.existsSync(path.join(out, '.nojekyll')));

  var page = read('demo/index.html');
  var shim = page.indexOf('js/demo-static.js');
  assert.ok(shim !== -1 && shim < page.indexOf('js/app.js'), 'the demo data loads before the app');
  ['js/app.js', 'js/logic.js', 'css/posterlight.css', 'fonts/limelight-400.woff2', 'icons/logo.svg',
   'demo/demo-poster.svg', 'demo/demo-face-1.svg', 'manifest.webmanifest'].forEach(function (f) {
    assert.ok(fs.existsSync(path.join(out, 'demo', f)), f);
  });
  assert.ok(!fs.existsSync(path.join(out, 'demo', 'setup.html')), 'the setup page is not part of the demo');

  var data = read('demo/js/demo-static.js');
  assert.match(data, /Midnight at the Rialto/);
  assert.ok(!/=>|\blet\s|\bconst\s|`/.test(data), 'ES5 only');
  assert.doesNotThrow(function () { new Function('window', 'location', data); });
});

test('the demo data cycles through screens and honours ?demo=', function () {
  var out = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-site-'));
  site.build(out);
  var code = fs.readFileSync(path.join(out, 'demo/js/demo-static.js'), 'utf8');
  function load(search) {
    var win = {};
    new Function('window', 'location', code)(win, { search: search });
    return win.PosterLightDemo;
  }
  var fixed = load('?demo=music');
  assert.strictEqual(fixed.status(0).media.type, 'track');
  assert.strictEqual(fixed.status(999999).media.type, 'track');
  var tour = load('');
  var seen = {};
  for (var t = 0; t < 120000; t += 1000) { var s = tour.status(t); seen[s.state + '|' + (s.media ? s.media.type : '-') + '|' + (s.fact ? 'fact' : '')] = true; }
  assert.ok(seen['playing|movie|'] && seen['playing|movie|fact'] && seen['playing|episode|'] && seen['playing|track|'] && seen['intermission|movie|']);
  assert.strictEqual(load('?demo=nope').status(0).media.type, 'movie');
});

test('the published website in docs/ matches the current page files', function () {
  // If this fails, run: npm run site
  var root = path.join(__dirname, '..');
  ['js/app.js', 'js/logic.js', 'css/posterlight.css'].forEach(function (f) {
    assert.strictEqual(fs.readFileSync(path.join(root, 'docs', 'demo', f), 'utf8'),
      fs.readFileSync(path.join(root, 'public', f), 'utf8'), f + ' is out of date in docs/demo');
  });
  assert.strictEqual(fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8'),
    fs.readFileSync(path.join(root, 'site', 'index.html'), 'utf8'));
});
