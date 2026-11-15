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
  assert.match(landing, /href="app\/"/);
  assert.match(landing, /not affiliated with/i);
  assert.ok(!/(src|href)="https?:\/\/(?!github\.com\/csdarlington86\/posterlight|nodejs\.org)/.test(landing), 'no third-party assets');
  assert.ok(fs.existsSync(path.join(out, '.nojekyll')));

  var page = read('demo/index.html');
  var shim = page.indexOf('js/demo-static.js');
  assert.ok(shim !== -1 && shim < page.indexOf('js/app.js'), 'the demo data loads before the app');
  ['js/app.js', 'js/logic.js', 'css/posterlight.css', 'fonts/limelight-400.woff2', 'icons/logo.svg',
   'demo/demo-poster.svg', 'manifest.webmanifest'].forEach(function (f) {
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
    return win.PosterLightLocal;
  }
  var fixed = load('?demo=music');
  assert.strictEqual(fixed.statusAt(0).media.type, 'track');
  assert.strictEqual(fixed.statusAt(999999).media.type, 'track');
  var tour = load('');
  var seen = {};
  for (var t = 0; t < 120000; t += 1000) { var s = tour.statusAt(t); seen[s.state + '|' + (s.media ? s.media.type : '-') + '|'] = true; }
  assert.ok(seen['playing|movie|'] && seen['playing|episode|'] && seen['playing|track|'] && seen['intermission|movie|']);
  assert.strictEqual(load('?demo=nope').statusAt(0).media.type, 'movie');
});

test('the web app bundles the engine, and the connect screen', function () {
  var out = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-site-'));
  site.build(out);
  function read(rel) { return fs.readFileSync(path.join(out, rel), 'utf8'); }
  var page = read('app/index.html');
  var bundleAt = page.indexOf('js/posterlight-web.js');
  var bootAt = page.indexOf('js/app-boot.js');
  assert.ok(bundleAt !== -1 && bundleAt < bootAt && bootAt < page.indexOf('js/app.js'), 'bundle, then boot, then the page script');
  assert.match(read('app/connect.html'), /plex\.tv\/link/);
  ['js/connect.js', 'css/setup.css', 'js/logic.js', 'manifest.webmanifest', 'icons/icon-180.png'].forEach(function (f) {
    assert.ok(fs.existsSync(path.join(out, 'app', f)), f);
  });
  assert.ok(!fs.existsSync(path.join(out, 'app', 'setup.html')));

  // The bundle must load as a plain script in an old browser and give the page a working engine.
  var bundle = read('app/js/posterlight-web.js');
  assert.ok(!/=>|\blet\s|\bconst\s|`|\?\.[a-zA-Z_(]|\?\?/.test(bundle.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'old-browser syntax only');
  var win = { localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} } };
  new Function('window', 'XMLHttpRequest', bundle)(win, function () {});
  assert.strictEqual(typeof win.PosterLightWeb.createWebEngine, 'function');
  assert.strictEqual(typeof win.PosterLightWeb.createWebConnect, 'function');
  assert.strictEqual(typeof win.PosterLightWeb.request, 'function');
  var engine = win.PosterLightWeb.createWebEngine({ request: function () {}, storage: win.PosterLightWeb.storage });
  assert.strictEqual(engine.status('any').state, 'setup');
});

test('the website scripts use old-browser syntax', function () {
  ['app-boot.js', 'connect.js', 'web-runtime.js'].forEach(function (f) {
    var code = fs.readFileSync(path.join(__dirname, '..', 'site', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.ok(!/=>|\blet\s|\bconst\s|`|\bfetch\(|\basync\s|\.\.\./.test(code), f);
    assert.doesNotThrow(function () { new Function(code); }, f);
  });
});
