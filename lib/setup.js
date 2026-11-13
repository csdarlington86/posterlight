'use strict';
// First-time setup: sign in with Plex, pick a server, save the settings.
// Every step is a plain function with its outside world passed in, so the tests need no network.
//
// Who may use setup:
//   - the helper computer itself (a loopback request), or
//   - another device that knows the setup code printed in the helper window.
// Every request must also carry the header "X-PosterLight: 1". A web page on another site
// cannot add that header, so it cannot talk to the helper behind the person's back.
var crypto = require('crypto');

var MAX_WRONG_CODES = 10;
var LOOPBACK = { '127.0.0.1': true, '::1': true, '::ffff:127.0.0.1': true };
var LOCAL_HOSTS = { 'localhost': true, '127.0.0.1': true, '[::1]': true };

function hostName(host) {
  var h = String(host || '').toLowerCase();
  if (h.charAt(0) === '[') return h.slice(0, h.indexOf(']') + 1);
  return h.split(':')[0];
}

function sameText(a, b) {
  var x = Buffer.from(String(a));
  var y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function createSetup(options) {
  var account = options.account;
  var testServer = options.testServer;
  var saveConfig = options.saveConfig;
  var isConfigured = options.isConfigured;
  var setupCode = String(options.setupCode);

  var wrongCodes = 0;
  var pinId = null;
  var servers = null;   // filled after sign-in; holds tokens, never sent to the page

  function authorize(req) {
    if (req.header !== '1') return { ok: false, status: 403, error: 'bad-request' };
    // A loopback request must also name a local host. Otherwise a website that points its
    // own name at 127.0.0.1 could pose as the helper computer.
    if (LOOPBACK[req.remoteAddress] && LOCAL_HOSTS[hostName(req.host)]) return { ok: true };
    if (wrongCodes >= MAX_WRONG_CODES) return { ok: false, status: 429, error: 'locked' };
    var code = String(req.code === undefined || req.code === null ? '' : req.code).trim();
    if (!code) return { ok: false, status: 401, error: 'code-needed' };
    if (!sameText(code, setupCode)) {
      wrongCodes += 1;
      return { ok: false, status: 401, error: 'code-wrong' };
    }
    return { ok: true };
  }

  function reply(status, json) { return { status: status, json: json }; }

  function save(plexUrl, plexToken) {
    saveConfig({ plexUrl: plexUrl, plexToken: plexToken });
    pinId = null;
    servers = null;
  }

  var steps = {
    'status': function () {
      return Promise.resolve(reply(200, { configured: !!isConfigured() }));
    },

    'signin-start': function () {
      return account.createPin().then(function (pin) {
        pinId = pin.id;
        servers = null;
        return reply(200, { authUrl: pin.authUrl });
      });
    },

    'signin-check': function () {
      if (pinId === null) return Promise.resolve(reply(409, { error: 'not-started' }));
      var pending = servers ? Promise.resolve(servers) : account.checkPin(pinId).then(function (token) {
        return token ? account.listServers(token) : null;
      });
      return pending.then(function (list) {
        if (!list) return reply(200, { signedIn: false });
        servers = list;
        return reply(200, {
          signedIn: true,
          servers: list.map(function (s) { return { id: s.id, name: s.name, owned: s.owned }; })
        });
      });
    },

    'choose-server': function (body) {
      if (!servers) return Promise.resolve(reply(409, { error: 'not-signed-in' }));
      var server = servers.filter(function (s) { return s.id === String(body.id); })[0];
      if (!server) return Promise.resolve(reply(404, { error: 'unknown-server' }));
      // Try each address in turn and keep the first one this computer can reach.
      function tryNext(i) {
        if (i >= server.urls.length) return Promise.resolve(reply(502, { error: 'unreachable', name: server.name }));
        return testServer(server.urls[i], server.accessToken).then(function (ok) {
          if (!ok) return tryNext(i + 1);
          save(server.urls[i], server.accessToken);
          return reply(200, { ok: true, name: server.name });
        });
      }
      return tryNext(0);
    },

    'manual': function (body) {
      var plexUrl = String(body.plexUrl || '').trim().replace(/\/+$/, '');
      var plexToken = String(body.plexToken || '').trim();
      if (!/^https?:\/\/[^\s\/]+$/i.test(plexUrl)) return Promise.resolve(reply(400, { error: 'bad-address' }));
      if (!plexToken) return Promise.resolve(reply(400, { error: 'no-token' }));
      return testServer(plexUrl, plexToken).then(function (ok) {
        if (!ok) return reply(502, { error: 'unreachable' });
        save(plexUrl, plexToken);
        return reply(200, { ok: true });
      });
    }
  };

  function run(step, body) {
    if (!Object.prototype.hasOwnProperty.call(steps, step)) return Promise.resolve(reply(404, { error: 'unknown-step' }));
    var result;
    try {
      result = steps[step](body && typeof body === 'object' ? body : {});
    } catch (e) {
      result = Promise.reject(e);
    }
    // Error text from the network is never passed on: it could carry a token.
    return result.then(null, function () { return reply(502, { error: 'plex-failed' }); });
  }

  return { authorize: authorize, run: run };
}

function newSetupCode() {
  return String(crypto.randomInt(0, 1000000) + 1000000).slice(1);
}

module.exports = { createSetup: createSetup, newSetupCode: newSetupCode };
