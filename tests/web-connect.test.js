'use strict';
var test = require('node:test');
var assert = require('node:assert');
var createWebConnect = require('../lib/web-connect').createWebConnect;

function memoryStorage() {
  var data = {};
  return { data: data, getItem: function (k) { return k in data ? data[k] : null; }, setItem: function (k, v) { data[k] = String(v); }, removeItem: function (k) { delete data[k]; } };
}

function world(routes) {
  var calls = [];
  var storage = memoryStorage();
  var connect = createWebConnect({
    storage: storage,
    random: function () { return 0.5; },
    request: function (method, url, headers, timeoutMs, done) {
      calls.push({ method: method, url: url, headers: headers });
      var hit = routes[method + ' ' + url.split('?')[0]];
      if (hit === undefined) return done({ status: 404 });
      if (hit && hit.__error) return done(hit.__error);
      done(null, hit);
    }
  });
  return { connect: connect, calls: calls, storage: storage };
}

test('a link code is short, upper case, and asked for with a stable client id', function (t, done) {
  var w = world({ 'POST https://plex.tv/api/v2/pins': { id: 9, code: 'ab3d' } });
  w.connect.createLinkCode(function (err, pin) {
    assert.deepStrictEqual(pin, { id: 9, code: 'AB3D' });
    assert.strictEqual(w.calls[0].url, 'https://plex.tv/api/v2/pins');
    var id = w.calls[0].headers['X-Plex-Client-Identifier'];
    assert.match(id, /^posterlight-web-[0-9a-f]{24}$/);
    assert.strictEqual(w.storage.data['posterlight.clientId'], id);
    w.connect.createLinkCode(function () {
      assert.strictEqual(w.calls[1].headers['X-Plex-Client-Identifier'], id);
      done();
    });
  });
});

test('the on-this-device sign-in sends the person to Plex and brings them back with the pin', function (t, done) {
  var w = world({ 'POST https://plex.tv/api/v2/pins': { id: 77, code: 'longstrongcode' } });
  w.connect.createRedirect('https://site.example/app/connect.html', function (err, pin) {
    assert.match(w.calls[0].url, /pins\?strong=true$/);
    assert.match(pin.authUrl, /^https:\/\/app\.plex\.tv\/auth#\?clientID=posterlight-web-/);
    assert.ok(pin.authUrl.indexOf('code=longstrongcode') !== -1);
    assert.ok(pin.authUrl.indexOf('forwardUrl=' + encodeURIComponent('https://site.example/app/connect.html?pin=77')) !== -1);
    done();
  });
});

test('checkPin gives null while waiting and the token after sign-in', function (t, done) {
  var w = world({ 'GET https://plex.tv/api/v2/pins/9': { authToken: null } });
  w.connect.checkPin(9, function (err, token) {
    assert.strictEqual(token, null);
    var w2 = world({ 'GET https://plex.tv/api/v2/pins/9': { authToken: 'ACCOUNT' } });
    w2.connect.checkPin(9, function (err2, token2) { assert.strictEqual(token2, 'ACCOUNT'); done(); });
  });
});

var RESOURCES = [
  { name: 'Den PC', clientIdentifier: 'srv1', provides: 'server', owned: true, accessToken: 'SRV',
    connections: [
      { uri: 'http://192.168.1.50:32400', local: true },
      { uri: 'https://relay.plex.direct:8443', local: false, relay: true },
      { uri: 'https://remote.plex.direct:32400', local: false },
      { uri: 'https://local.plex.direct:32400', local: true }
    ] },
  { name: 'Friend NAS', clientIdentifier: 'srv2', provides: 'server', owned: false, accessToken: 'SHARED', connections: [] },
  { name: 'Phone', clientIdentifier: 'p', provides: 'player', owned: true, connections: [] }
];

test('listServers keeps owned servers and only https addresses: local, remote, then relay', function (t, done) {
  var w = world({ 'GET https://plex.tv/api/v2/resources': RESOURCES });
  w.connect.listServers('ACCOUNT', function (err, out) {
    assert.strictEqual(w.calls[0].headers['X-Plex-Token'], 'ACCOUNT');
    assert.ok(w.calls[0].url.indexOf('ACCOUNT') === -1);
    assert.strictEqual(out.shared, 1);
    assert.strictEqual(out.servers.length, 1);
    assert.deepStrictEqual(out.servers[0].urls,
      ['https://local.plex.direct:32400', 'https://remote.plex.direct:32400', 'https://relay.plex.direct:8443']);
    done();
  });
});

test('connect saves the first address that answers a signed-in request', function (t, done) {
  var w = world({ 'GET https://remote.plex.direct:32400/status/sessions': { MediaContainer: { size: 0 } } });
  var server = { id: 'srv1', name: 'Den PC', accessToken: 'SRV', urls: ['https://local.plex.direct:32400', 'https://remote.plex.direct:32400'] };
  w.connect.connect(server, function (err, out) {
    assert.strictEqual(err, null);
    assert.deepStrictEqual(out, { name: 'Den PC' });
    assert.strictEqual(w.calls[0].headers['X-Plex-Token'], 'SRV');
    assert.deepStrictEqual(JSON.parse(w.storage.data['posterlight.web']),
      { serverUrl: 'https://remote.plex.direct:32400', token: 'SRV', serverName: 'Den PC' });
    done();
  });
});

test('connect reports a server no address can reach, and saves nothing', function (t, done) {
  var w = world({});
  w.connect.connect({ id: 's', name: 'X', accessToken: 'SRV', urls: ['https://a.plex.direct:32400'] }, function (err) {
    assert.deepStrictEqual(err, { error: 'unreachable' });
    assert.strictEqual(w.storage.data['posterlight.web'], undefined);
    w.connect.connect({ id: 's', name: 'X', accessToken: 'SRV', urls: [] }, function (err2) {
      assert.deepStrictEqual(err2, { error: 'unreachable' });
      done();
    });
  });
});

test('connect reports a refused sign-in', function (t, done) {
  var w = world({ 'GET https://a.plex.direct:32400/status/sessions': { __error: { status: 401 } } });
  w.connect.connect({ id: 's', name: 'X', accessToken: 'SRV', urls: ['https://a.plex.direct:32400'] }, function (err) {
    assert.deepStrictEqual(err, { error: 'not-owner' });
    done();
  });
});
