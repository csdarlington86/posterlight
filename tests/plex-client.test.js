'use strict';
var test = require('node:test');
var assert = require('node:assert');
var createPlexClient = require('../lib/plex-client').createPlexClient;

function fakeFetch(response) {
  var calls = [];
  var fn = function (url, opts) {
    calls.push({ url: url, opts: opts });
    if (response instanceof Error) return Promise.reject(response);
    return Promise.resolve(response);
  };
  fn.calls = calls;
  return fn;
}

function jsonResponse(obj, status) {
  return {
    ok: (status || 200) < 300, status: status || 200,
    headers: { get: function () { return 'application/json'; } },
    json: function () { return Promise.resolve(obj); }
  };
}

function client(fetchImpl) {
  return createPlexClient({ plexUrl: 'http://x:32400', plexToken: 'SECRET123', fetchImpl: fetchImpl });
}

test('getJson calls Plex with the token in a header, never in the URL', async function () {
  var f = fakeFetch(jsonResponse({ MediaContainer: {} }));
  var out = await client(f).getJson('/status/sessions');
  assert.deepStrictEqual(out, { MediaContainer: {} });
  assert.strictEqual(f.calls[0].url, 'http://x:32400/status/sessions');
  assert.strictEqual(f.calls[0].opts.headers['X-Plex-Token'], 'SECRET123');
  assert.strictEqual(f.calls[0].opts.headers.Accept, 'application/json');
  assert.ok(f.calls[0].url.indexOf('SECRET123') === -1);
});

test('getImage asks the Plex photo transcoder for the size', async function () {
  var f = fakeFetch({
    ok: true, status: 200,
    headers: { get: function () { return 'image/jpeg'; } },
    arrayBuffer: function () { return Promise.resolve(new Uint8Array([1, 2, 3]).buffer); }
  });
  var img = await client(f).getImage('/library/metadata/1/thumb/2', 400, 600);
  assert.strictEqual(f.calls[0].url,
    'http://x:32400/photo/:/transcode?width=400&height=600&minSize=1&upscale=0&url=%2Flibrary%2Fmetadata%2F1%2Fthumb%2F2');
  assert.strictEqual(img.contentType, 'image/jpeg');
  assert.ok(Buffer.isBuffer(img.body));
  assert.strictEqual(img.body.length, 3);
});

test('a non-200 answer rejects with the status', async function () {
  await assert.rejects(client(fakeFetch(jsonResponse({}, 401))).getJson('/status/sessions'), /401/);
});

test('an error message never contains the token', async function () {
  var f = fakeFetch(new Error('connect failed for http://x:32400/?X-Plex-Token=SECRET123'));
  await assert.rejects(client(f).getJson('/status/sessions'), function (e) {
    return e.message.indexOf('SECRET123') === -1 && /connect failed/.test(e.message);
  });
});

test('a non-image answer from the transcoder rejects', async function () {
  var f = fakeFetch({
    ok: true, status: 200,
    headers: { get: function () { return 'text/html'; } },
    arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(4)); }
  });
  await assert.rejects(client(f).getImage('/x', 100, 100), /image/);
});

test('a body that stalls is cut off by the timeout', async function () {
  var f = function (url, opts) {
    return Promise.resolve({
      ok: true, status: 200, headers: { get: function () { return 'application/json'; } },
      json: function () {
        return new Promise(function (resolve, reject) {
          opts.signal.addEventListener('abort', function () {
            var e = new Error('aborted'); e.name = 'AbortError'; reject(e);
          });
        });
      }
    });
  };
  var c = createPlexClient({ plexUrl: 'http://x:32400', plexToken: 'SECRET123', fetchImpl: f, timeoutMs: 40 });
  await assert.rejects(c.getJson('/status/sessions'), /no answer in 40 ms/);
});

test('requests never follow a redirect, so the token cannot be sent to another host', async function () {
  var f = fakeFetch(jsonResponse({}));
  await client(f).getJson('/status/sessions');
  assert.strictEqual(f.calls[0].opts.redirect, 'manual');
  var redirected = fakeFetch({ ok: false, status: 302, headers: { get: function () { return null; } } });
  await assert.rejects(client(redirected).getJson('/status/sessions'), /302/);
});

test('the body of a refused answer is released', async function () {
  var cancelled = 0;
  var f = fakeFetch({ ok: false, status: 401, headers: { get: function () { return null; } },
    body: { cancel: function () { cancelled += 1; return Promise.resolve(); } } });
  await assert.rejects(client(f).getJson('/status/sessions'), /401/);
  assert.strictEqual(cancelled, 1);
});
