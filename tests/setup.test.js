'use strict';
var test = require('node:test');
var assert = require('node:assert');
var createSetup = require('../lib/setup').createSetup;

function make(over) {
  var saved = [];
  var tested = [];
  var opts = {
    setupCode: '123456',
    account: {
      createPin: function () { return Promise.resolve({ id: 42, authUrl: 'https://app.plex.tv/auth#?code=x' }); },
      checkPin: function () { return Promise.resolve('ACCOUNT-TOKEN'); },
      listServers: function () {
        return Promise.resolve([
          { id: 'srv1', name: 'Den PC', owned: true, accessToken: 'SRV-TOKEN', urls: ['http://192.168.1.50:32400', 'https://a.plex.direct:32400'] },
          { id: 'srv2', name: 'Friend NAS', owned: false, accessToken: 'SHARED', urls: [] }
        ]);
      }
    },
    testServer: function (url, token) {
      tested.push(url);
      return Promise.resolve(url === 'https://a.plex.direct:32400' && token === 'SRV-TOKEN');
    },
    saveConfig: function (cfg) { saved.push(cfg); },
    isConfigured: function () { return saved.length > 0; }
  };
  Object.keys(over || {}).forEach(function (k) { opts[k] = over[k]; });
  return { setup: createSetup(opts), saved: saved, tested: tested };
}

var LOCAL = { remoteAddress: '127.0.0.1', host: 'localhost:8686', header: '1' };

// ---- who may use setup ----

test('the helper computer itself may use setup with no code', function () {
  var s = make().setup;
  assert.strictEqual(s.authorize(LOCAL).ok, true);
  assert.strictEqual(s.authorize({ remoteAddress: '::1', host: '[::1]:8686', header: '1' }).ok, true);
  assert.strictEqual(s.authorize({ remoteAddress: '::ffff:127.0.0.1', host: '127.0.0.1:8686', header: '1' }).ok, true);
});

test('another device needs the setup code', function () {
  var s = make().setup;
  var lan = { remoteAddress: '192.168.1.77', host: '192.168.1.20:8686', header: '1' };
  assert.deepStrictEqual(s.authorize(lan), { ok: false, status: 401, error: 'code-needed' });
  assert.strictEqual(s.authorize(Object.assign({ code: '000000' }, lan)).ok, false);
  assert.strictEqual(s.authorize(Object.assign({ code: '123456' }, lan)).ok, true);
  assert.strictEqual(s.authorize(Object.assign({ code: ' 123456 ' }, lan)).ok, true);
});

test('a request without the PosterLight header is refused', function () {
  var s = make().setup;
  assert.deepStrictEqual(s.authorize({ remoteAddress: '127.0.0.1', host: 'localhost:8686' }),
    { ok: false, status: 403, error: 'bad-request' });
});

test('a loopback request with a foreign Host name is treated as another device', function () {
  // Guards against a website whose name is pointed at 127.0.0.1 (DNS rebinding).
  var s = make().setup;
  assert.strictEqual(s.authorize({ remoteAddress: '127.0.0.1', host: 'evil.example:8686', header: '1' }).ok, false);
});

test('ten wrong codes lock code entry until the helper restarts', function () {
  var s = make().setup;
  var lan = { remoteAddress: '192.168.1.77', host: '192.168.1.20:8686', header: '1' };
  for (var i = 0; i < 10; i++) s.authorize(Object.assign({ code: '99999' + (i % 10) }, lan));
  assert.deepStrictEqual(s.authorize(Object.assign({ code: '123456' }, lan)), { ok: false, status: 429, error: 'locked' });
  assert.strictEqual(s.authorize(LOCAL).ok, true, 'the helper computer is never locked out');
});

// ---- the steps ----

test('sign-in start returns the Plex address to open', async function () {
  var out = await make().setup.run('signin-start', {});
  assert.deepStrictEqual(out, { status: 200, json: { authUrl: 'https://app.plex.tv/auth#?code=x' } });
});

test('sign-in check before start says so', async function () {
  var out = await make().setup.run('signin-check', {});
  assert.strictEqual(out.status, 409);
});

test('sign-in check reports waiting, then the servers without any token', async function () {
  var n = 0;
  var ctx = make({
    account: {
      createPin: function () { return Promise.resolve({ id: 42, authUrl: 'u' }); },
      checkPin: function () { n += 1; return Promise.resolve(n < 2 ? null : 'ACCOUNT-TOKEN'); },
      listServers: function () { return Promise.resolve([{ id: 'srv1', name: 'Den PC', owned: true, accessToken: 'SRV-TOKEN', urls: ['http://x'] }]); }
    }
  });
  await ctx.setup.run('signin-start', {});
  assert.deepStrictEqual((await ctx.setup.run('signin-check', {})).json, { signedIn: false });
  var done = await ctx.setup.run('signin-check', {});
  assert.deepStrictEqual(done.json, { signedIn: true, servers: [{ id: 'srv1', name: 'Den PC', owned: true }] });
  assert.ok(JSON.stringify(done).indexOf('TOKEN') === -1);
});

test('choosing a server tries each address and saves the first that answers', async function () {
  var ctx = make();
  await ctx.setup.run('signin-start', {});
  await ctx.setup.run('signin-check', {});
  var out = await ctx.setup.run('choose-server', { id: 'srv1' });
  assert.deepStrictEqual(ctx.tested, ['http://192.168.1.50:32400', 'https://a.plex.direct:32400']);
  assert.deepStrictEqual(ctx.saved, [{ plexUrl: 'https://a.plex.direct:32400', plexToken: 'SRV-TOKEN' }]);
  assert.deepStrictEqual(out, { status: 200, json: { ok: true, name: 'Den PC' } });
  assert.ok(JSON.stringify(out).indexOf('SRV-TOKEN') === -1);
});

test('a server that answers on no address is not saved', async function () {
  var ctx = make();
  await ctx.setup.run('signin-start', {});
  await ctx.setup.run('signin-check', {});
  var out = await ctx.setup.run('choose-server', { id: 'srv2' });
  assert.strictEqual(out.status, 502);
  assert.strictEqual(out.json.error, 'unreachable');
  assert.deepStrictEqual(ctx.saved, []);
});

test('choosing before sign-in, or an unknown server, is refused', async function () {
  var ctx = make();
  assert.strictEqual((await ctx.setup.run('choose-server', { id: 'srv1' })).status, 409);
  await ctx.setup.run('signin-start', {});
  await ctx.setup.run('signin-check', {});
  assert.strictEqual((await ctx.setup.run('choose-server', { id: 'nope' })).status, 404);
});

test('manual entry checks the address shape, tests it, and saves', async function () {
  var ctx = make({ testServer: function (url, token) { return Promise.resolve(url === 'http://10.0.0.5:32400' && token === 'tok'); } });
  assert.strictEqual((await ctx.setup.run('manual', { plexUrl: 'ftp://x', plexToken: 'tok' })).status, 400);
  assert.strictEqual((await ctx.setup.run('manual', { plexUrl: 'http://10.0.0.5:32400', plexToken: '' })).status, 400);
  assert.strictEqual((await ctx.setup.run('manual', { plexUrl: 'http://10.0.0.9:32400', plexToken: 'tok' })).status, 502);
  var ok = await ctx.setup.run('manual', { plexUrl: ' http://10.0.0.5:32400/ ', plexToken: ' tok ' });
  assert.strictEqual(ok.status, 200);
  assert.deepStrictEqual(ctx.saved, [{ plexUrl: 'http://10.0.0.5:32400', plexToken: 'tok' }]);
});

test('status says whether the helper is configured', async function () {
  var ctx = make();
  assert.deepStrictEqual((await ctx.setup.run('status', {})).json, { configured: false });
  await ctx.setup.run('manual', { plexUrl: 'https://a.plex.direct:32400', plexToken: 'SRV-TOKEN' });
  assert.deepStrictEqual((await ctx.setup.run('status', {})).json, { configured: true });
});

test('an unknown step is 404 and a failing plex.tv is 502, with no token in the message', async function () {
  var ctx = make({ account: { createPin: function () { return Promise.reject(new Error('boom ACCOUNT-TOKEN')); } } });
  assert.strictEqual((await ctx.setup.run('nope', {})).status, 404);
  var out = await ctx.setup.run('signin-start', {});
  assert.strictEqual(out.status, 502);
  assert.ok(JSON.stringify(out).indexOf('ACCOUNT-TOKEN') === -1);
});
