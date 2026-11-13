'use strict';
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var loadConfig = require('../lib/config').loadConfig;

function tmpFile(obj) {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-config-'));
  var file = path.join(dir, 'config.json');
  fs.writeFileSync(file, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return file;
}

test('loads values from the file', function () {
  var c = loadConfig(tmpFile({ plexUrl: 'http://x:32400', plexToken: 'abc', port: 9000 }), {});
  assert.deepStrictEqual(c, { plexUrl: 'http://x:32400', plexToken: 'abc', port: 9000 });
});

test('env overrides the file', function () {
  var c = loadConfig(tmpFile({ plexUrl: 'http://x:32400', plexToken: 'abc', port: 9000 }),
    { PLEX_URL: 'http://y:1', PLEX_TOKEN: 'zzz', PORT: '7000' });
  assert.deepStrictEqual(c, { plexUrl: 'http://y:1', plexToken: 'zzz', port: 7000 });
});

test('removes a trailing slash from plexUrl', function () {
  var c = loadConfig(tmpFile({ plexUrl: 'http://x:32400/', plexToken: 'abc' }), {});
  assert.strictEqual(c.plexUrl, 'http://x:32400');
});

test('default port is 8686', function () {
  var c = loadConfig(tmpFile({ plexUrl: 'http://x:32400', plexToken: 'abc' }), {});
  assert.strictEqual(c.port, 8686);
});

test('placeholder token throws a message naming the field and config.json', function () {
  assert.throws(function () {
    loadConfig(tmpFile({ plexUrl: 'http://x:32400', plexToken: 'PUT-TOKEN-HERE' }), {});
  }, function (e) { return /plexToken/.test(e.message) && /config\.json/.test(e.message); });
});

test('missing plexUrl throws a message naming the field', function () {
  assert.throws(function () { loadConfig(tmpFile({ plexToken: 'abc' }), {}); }, /plexUrl/);
});

test('a missing file works when env has everything', function () {
  var c = loadConfig('/nonexistent/config.json', { PLEX_URL: 'http://y:1', PLEX_TOKEN: 'zzz' });
  assert.strictEqual(c.plexToken, 'zzz');
});

test('a file that is not valid JSON throws a message naming config.json', function () {
  assert.throws(function () { loadConfig(tmpFile('{nope'), {}); }, /config\.json/);
});

test('saveConfig writes a file that loadConfig reads back, and keeps the port', function () {
  var config = require('../lib/config');
  var file = tmpFile({ plexUrl: 'http://old:32400', plexToken: 'old', port: 9001 });
  config.saveConfig(file, { plexUrl: 'http://new:32400', plexToken: 'new' });
  assert.deepStrictEqual(loadConfig(file, {}), { plexUrl: 'http://new:32400', plexToken: 'new', port: 9001 });
});

test('saveConfig creates the folder and the file when they are missing', function () {
  var config = require('../lib/config');
  var file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pl-config-')), 'deep', 'config.json');
  config.saveConfig(file, { plexUrl: 'http://new:32400', plexToken: 'new' });
  assert.strictEqual(loadConfig(file, {}).port, 8686);
});

test('loadPort works even when the rest of the config is missing', function () {
  var config = require('../lib/config');
  assert.strictEqual(config.loadPort('/nonexistent/config.json', {}), 8686);
  assert.strictEqual(config.loadPort('/nonexistent/config.json', { PORT: '9100' }), 9100);
  assert.strictEqual(config.loadPort(tmpFile({ port: 9002 }), {}), 9002);
  assert.strictEqual(config.loadPort(tmpFile('{nope'), {}), 8686);
});
