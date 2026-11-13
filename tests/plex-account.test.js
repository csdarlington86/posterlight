'use strict';
var test = require('node:test');
var assert = require('node:assert');
var createPlexAccount = require('../lib/plex-account').createPlexAccount;

function fake(routes) {
  var calls = [];
  var fn = function (url, opts) {
    calls.push({ url: url, opts: opts || {} });
    var key = ((opts && opts.method) || 'GET') + ' ' + url.split('?')[0];
    var hit = routes[key];
    if (!hit) return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); } });
    if (hit instanceof Error) return Promise.reject(hit);
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(hit); } });
  };
  fn.calls = calls;
  return fn;
}

function account(f) {
  return createPlexAccount({ fetchImpl: f, clientId: 'client-123', baseUrl: 'https://plex.test' });
}

test('createPin asks plex.tv for a strong pin and builds the sign-in address', async function () {
  var f = fake({ 'POST https://plex.test/api/v2/pins': { id: 42, code: 'abcd1234' } });
  var pin = await account(f).createPin();
  assert.strictEqual(pin.id, 42);
  assert.match(f.calls[0].url, /\/api\/v2\/pins\?strong=true$/);
  assert.strictEqual(f.calls[0].opts.headers['X-Plex-Client-Identifier'], 'client-123');
  assert.strictEqual(f.calls[0].opts.headers['X-Plex-Product'], 'PosterLight');
  assert.strictEqual(f.calls[0].opts.headers.Accept, 'application/json');
  assert.match(pin.authUrl, /^https:\/\/app\.plex\.tv\/auth#\?/);
  assert.ok(pin.authUrl.indexOf('clientID=client-123') !== -1);
  assert.ok(pin.authUrl.indexOf('code=abcd1234') !== -1);
  assert.ok(pin.authUrl.indexOf('PosterLight') !== -1);
});

test('checkPin gives null until the person has signed in, then the token', async function () {
  var waiting = fake({ 'GET https://plex.test/api/v2/pins/42': { id: 42, authToken: null } });
  assert.strictEqual(await account(waiting).checkPin(42), null);
  var done = fake({ 'GET https://plex.test/api/v2/pins/42': { id: 42, authToken: 'ACCOUNT-TOKEN' } });
  assert.strictEqual(await account(done).checkPin(42), 'ACCOUNT-TOKEN');
});

test('checkPin rejects when the pin has expired', async function () {
  await assert.rejects(account(fake({})).checkPin(42), /404/);
});

test('listServers keeps only servers and orders the connections local first', async function () {
  var f = fake({ 'GET https://plex.test/api/v2/resources': [
    { name: 'Den PC', clientIdentifier: 'srv1', provides: 'server', owned: true, accessToken: 'SRV-TOKEN',
      connections: [
        { protocol: 'https', address: '203.0.113.9', port: 32400, uri: 'https://203-0-113-9.x.plex.direct:32400', local: false, relay: false },
        { protocol: 'https', address: '192.168.1.50', port: 32400, uri: 'https://192-168-1-50.x.plex.direct:32400', local: true, relay: false },
        { protocol: 'https', address: 'relay', port: 8443, uri: 'https://relay.plex.direct:8443', local: false, relay: true }
      ] },
    { name: 'Phone', clientIdentifier: 'p1', provides: 'client,player', connections: [] },
    { name: 'Friend NAS', clientIdentifier: 'srv2', provides: 'server,other', owned: false, accessToken: 'SHARED', connections: [] }
  ] });
  var servers = await account(f).listServers('ACCOUNT-TOKEN');
  assert.strictEqual(f.calls[0].opts.headers['X-Plex-Token'], 'ACCOUNT-TOKEN');
  assert.ok(f.calls[0].url.indexOf('ACCOUNT-TOKEN') === -1);
  assert.deepStrictEqual(servers.map(function (s) { return s.id; }), ['srv1', 'srv2']);
  assert.strictEqual(servers[0].name, 'Den PC');
  assert.strictEqual(servers[0].owned, true);
  assert.strictEqual(servers[0].accessToken, 'SRV-TOKEN');
  assert.deepStrictEqual(servers[0].urls, [
    'http://192.168.1.50:32400',
    'https://192-168-1-50.x.plex.direct:32400',
    'https://203-0-113-9.x.plex.direct:32400'
  ]);
});

test('listServers survives an odd answer', async function () {
  assert.deepStrictEqual(await account(fake({ 'GET https://plex.test/api/v2/resources': { nope: true } })).listServers('t'), []);
});
