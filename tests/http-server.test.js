'use strict';
var test = require('node:test');
var assert = require('node:assert');
var http = require('http');
var path = require('path');
var createHttpServer = require('../lib/http-server').createHttpServer;
var createImageRegistry = require('../lib/image-registry').createImageRegistry;

function start(over) {
  var images = createImageRegistry();
  var imageCalls = [];
  var deps = {
    publicDir: path.join(__dirname, '..', 'public'),
    images: images,
    getStatus: function (playerId) { return { plexOk: true, player: null, state: 'idle', brightness: 'dim', media: null, fact: null, asked: playerId }; },
    getPlayers: function () { return [{ id: 'abc', name: 'Living Room', active: true }]; },
    getImage: function (source, w, h) {
      imageCalls.push({ source: source, w: w, h: h });
      return Promise.resolve({ contentType: 'image/jpeg', body: Buffer.from([1, 2, 3]) });
    },
    isPlexOk: function () { return true; }
  };
  Object.keys(over || {}).forEach(function (k) { deps[k] = over[k]; });
  var server = createHttpServer(deps);
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () {
      resolve({ server: server, port: server.address().port, images: images, imageCalls: imageCalls });
    });
  });
}

// Raw request, so the path is sent exactly as written.
function get(ctx, rawPath) {
  return new Promise(function (resolve, reject) {
    var req = http.request({ host: '127.0.0.1', port: ctx.port, path: rawPath, method: 'GET' }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function withServer(over, fn) {
  var ctx = await start(over);
  try { await fn(ctx); } finally { ctx.server.close(); }
}

test('/api/status returns JSON that is never cached, default player any', async function () {
  await withServer(null, async function (ctx) {
    var res = await get(ctx, '/api/status');
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.strictEqual(res.headers['cache-control'], 'no-store');
    assert.strictEqual(JSON.parse(res.body).asked, 'any');
    var res2 = await get(ctx, '/api/status?player=abc%20def');
    assert.strictEqual(JSON.parse(res2.body).asked, 'abc def');
  });
});

test('/api/status?demo= returns a canned status, unknown demo falls back to live', async function () {
  await withServer(null, async function (ctx) {
    var tv = JSON.parse((await get(ctx, '/api/status?demo=tv')).body);
    assert.strictEqual(tv.media.type, 'episode');
    var live = JSON.parse((await get(ctx, '/api/status?demo=nope')).body);
    assert.strictEqual(live.asked, 'any');
  });
});

test('/api/players returns the player list', async function () {
  await withServer(null, async function (ctx) {
    var res = await get(ctx, '/api/players');
    assert.deepStrictEqual(JSON.parse(res.body), { players: [{ id: 'abc', name: 'Living Room', active: true }] });
    assert.strictEqual(res.headers['cache-control'], 'no-store');
  });
});

test('/img with an unknown id is 404 and fetches nothing', async function () {
  await withServer(null, async function (ctx) {
    assert.strictEqual((await get(ctx, '/img/zzz')).status, 404);
    assert.strictEqual((await get(ctx, '/img/http%3A%2F%2Fevil.example%2Fx.jpg')).status, 404);
    assert.strictEqual(ctx.imageCalls.length, 0);
  });
});

test('/img clamps sizes and serves the image with a cache header', async function () {
  await withServer(null, async function (ctx) {
    var id = ctx.images.idFor('/library/metadata/1/thumb/2');
    var res = await get(ctx, '/img/' + id + '?w=999999&h=abc');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'], 'image/jpeg');
    assert.match(res.headers['cache-control'], /max-age=86400/);
    assert.deepStrictEqual(ctx.imageCalls[0], { source: '/library/metadata/1/thumb/2', w: 1600, h: 400 });
    await get(ctx, '/img/' + id + '?w=999999&h=abc');
    assert.strictEqual(ctx.imageCalls.length, 1, 'the second request comes from memory');
  });
});

test('/img answers 502 when Plex fails', async function () {
  await withServer({ getImage: function () { return Promise.reject(new Error('down')); } }, async function (ctx) {
    var id = ctx.images.idFor('/library/metadata/1/thumb/2');
    assert.strictEqual((await get(ctx, '/img/' + id)).status, 502);
  });
});

test('/img serves demo art from public/demo', async function () {
  await withServer(null, async function (ctx) {
    var res = await get(ctx, '/img/demo-poster?w=400&h=600');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'], 'image/svg+xml');
    assert.strictEqual((await get(ctx, '/img/demo-..%2F..%2Fconfig')).status, 404);
  });
});

test('paths that try to leave public are 404', async function () {
  await withServer(null, async function (ctx) {
    assert.strictEqual((await get(ctx, '/../config.json')).status, 404);
    assert.strictEqual((await get(ctx, '/%2e%2e/config.json')).status, 404);
    assert.strictEqual((await get(ctx, '/..%2Fpackage.json')).status, 404);
    assert.strictEqual((await get(ctx, '/%00')).status, 404);
    assert.strictEqual((await get(ctx, '/%E0%A4%A')).status, 404);
  });
});

test('/ serves the page and the manifest has its content type', async function () {
  await withServer(null, async function (ctx) {
    var page = await get(ctx, '/');
    assert.strictEqual(page.status, 200);
    assert.match(page.headers['content-type'], /text\/html/);
    var withQuery = await get(ctx, '/?player=abc&demo=movie');
    assert.strictEqual(withQuery.status, 200);
    var manifest = await get(ctx, '/manifest.webmanifest');
    assert.match(manifest.headers['content-type'], /application\/manifest\+json/);
  });
});

test('/healthz reports Plex state; other methods are refused', async function () {
  await withServer(null, async function (ctx) {
    assert.deepStrictEqual(JSON.parse((await get(ctx, '/healthz')).body), { ok: true, plexOk: true });
    var res = await new Promise(function (resolve) {
      http.request({ host: '127.0.0.1', port: ctx.port, path: '/api/status', method: 'POST' }, resolve).end();
    });
    assert.strictEqual(res.statusCode, 405);
  });
});
