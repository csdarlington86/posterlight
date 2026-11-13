'use strict';
// Guards the iOS 12 Safari baseline: no modern syntax, no layout-thrashing animation.
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', 'public', rel), 'utf8');
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('app.js uses only ES5 syntax and old-browser APIs', function () {
  var code = stripComments(read('js/app.js'));
  var banned = [/=>/, /\blet\s/, /\bconst\s/, /\?\.[a-zA-Z_(\[]/, /\?\?/, /`/, /\bfetch\(/, /\basync\s/, /\bawait\s/,
    /\bclass\s/, /\.\.\./, /ResizeObserver/, /\.includes\(/, /\.padStart\(/, /Object\.assign/, /\.closest\(/];
  banned.forEach(function (re) { assert.ok(!re.test(code), 'app.js must not use ' + re); });
});

test('app.js parses as a classic script', function () {
  assert.doesNotThrow(function () { new Function(read('js/app.js')); });
});

test('the CSS avoids properties iOS 12 does not have', function () {
  var css = stripComments(read('css/posterlight.css'));
  assert.ok(!/(^|[\s;{])gap\s*:/.test(css), 'no flexbox gap');
  assert.ok(!/aspect-ratio/.test(css), 'no aspect-ratio');
  assert.ok(!/\binset\s*:/.test(css), 'no inset shorthand');
  assert.ok(!/clamp\(|min\(|max\(/.test(css), 'no clamp/min/max functions');
});

test('transitions and keyframes touch only opacity and transform', function () {
  var css = stripComments(read('css/posterlight.css'));
  var allowed = { opacity: true, transform: true, '-webkit-transform': true };
  var transitions = css.match(/transition(-property)?\s*:[^;}]+/g) || [];
  assert.ok(transitions.length > 0);
  transitions.forEach(function (decl) {
    decl.split(':')[1].split(',').forEach(function (part) {
      var prop = part.trim().split(/\s+/)[0];
      assert.ok(allowed[prop], 'transition on "' + prop + '" in: ' + decl);
    });
  });
  var frames = css.match(/@(-webkit-)?keyframes[^{]+\{([^{}]*\{[^{}]*\})+\s*\}/g) || [];
  assert.ok(frames.length > 0);
  frames.forEach(function (block) {
    var props = block.match(/([a-z-]+)\s*:/g) || [];
    props.forEach(function (p) {
      var name = p.replace(/\s*:$/, '');
      assert.ok(allowed[name], 'keyframes animate "' + name + '"');
    });
  });
});

test('fonts are local and no CDN is referenced', function () {
  var css = read('css/posterlight.css');
  var html = read('index.html');
  assert.ok(/fonts\/limelight-400\.woff2/.test(css) && /fonts\/inter-400\.woff2/.test(css));
  assert.ok(!/https?:\/\//.test(stripComments(css)));
  assert.ok(!/(src|href)="https?:\/\//.test(html));
});

test('index.html has the home-screen tags for iOS and Android', function () {
  var html = read('index.html');
  [
    /<meta name="viewport" content="[^"]*viewport-fit=cover[^"]*">/,
    /user-scalable=no/,
    /<meta name="apple-mobile-web-app-capable" content="yes">/,
    /<meta name="mobile-web-app-capable" content="yes">/,
    /<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">/,
    /<meta name="apple-mobile-web-app-title" content="PosterLight">/,
    /<meta name="theme-color" content="#14110F">/,
    /<link rel="manifest" href="manifest\.webmanifest">/,
    /<link rel="apple-touch-icon" sizes="120x120" href="icons\/icon-120\.png">/,
    /<link rel="apple-touch-icon" sizes="152x152" href="icons\/icon-152\.png">/,
    /<link rel="apple-touch-icon" sizes="167x167" href="icons\/icon-167\.png">/,
    /<link rel="apple-touch-icon" sizes="180x180" href="icons\/icon-180\.png">/,
    /<script src="js\/logic\.js"><\/script>/,
    /<script src="js\/app\.js"><\/script>/
  ].forEach(function (re) { assert.ok(re.test(html), 'missing ' + re); });
});
