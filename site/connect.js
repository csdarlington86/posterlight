/* The connect screen of the web app. Plain ES5: it must work on the old tablets too. */
(function () {
  'use strict';

  var web = window.PosterLightWeb;
  var connect = web.createWebConnect({ request: web.request, storage: web.storage });
  var CHECK_MS = 2500;
  var CODE_LIFE_MS = 14 * 60 * 1000;   // Plex link codes last about 15 minutes
  var PENDING_KEY = 'posterlight.pendingPin';
  var timer = null;

  function byId(id) { return document.getElementById(id); }
  function show(node, on) { node.style.display = on ? '' : 'none'; }
  function showStep(id) {
    var ids = ['step-start', 'step-servers', 'step-done'];
    for (var i = 0; i < ids.length; i++) show(byId(ids[i]), ids[i] === id);
  }
  function setError(id, text) {
    byId(id).textContent = text || '';
    show(byId(id), !!text);
  }
  function stopTimer() {
    if (timer) window.clearTimeout(timer);
    timer = null;
  }
  function param(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  var MESSAGES = {
    'plex': 'Plex did not answer. Check the internet connection, then tap "Start again".',
    'unreachable': 'This device could not reach your Plex server over a secure connection.',
    'not-owner': 'That server did not accept this sign-in. Sign in with the Plex account that owns the server.',
    'storage': 'This browser would not save the connection. Turn off Private Browsing and try again.'
  };
  var UNREACHABLE_HELP = 'Things to check: Plex Media Server is running. In Plex, Settings > Network > "Secure connections" is set to Preferred. ' +
    'Settings > Remote Access is turned on. If it still fails, your router may block Plex\'s secure home addresses; ' +
    'the downloadable PosterLight helper works in that case.';

  // ---- done ----

  function showDone(name) {
    stopTimer();
    byId('done-text').textContent = name ? 'This screen now follows "' + name + '".' : 'This screen is connected to your Plex server.';
    showStep('step-done');
  }

  // ---- choose a server ----

  function choose(server, button) {
    setError('server-error', null);
    show(byId('server-help'), false);
    if (button) button.disabled = true;
    byId('servers-title').textContent = 'Connecting to ' + server.name;
    connect.connect(server, function (err, out) {
      if (button) button.disabled = false;
      byId('servers-title').textContent = 'Choose your Plex server';
      if (err) {
        setError('server-error', MESSAGES[err.error] || MESSAGES.plex);
        if (err.error === 'unreachable') {
          byId('server-help').textContent = UNREACHABLE_HELP;
          show(byId('server-help'), true);
        }
        return;
      }
      showDone(out.name);
    });
  }

  function showServers(token) {
    stopTimer();
    showStep('step-servers');
    setError('server-error', null);
    var list = byId('server-list');
    while (list.firstChild) list.removeChild(list.firstChild);
    byId('servers-title').textContent = 'Looking for your Plex server';
    connect.listServers(token, function (err, out) {
      byId('servers-title').textContent = 'Choose your Plex server';
      if (err) return setError('server-error', MESSAGES.plex);
      if (!out.servers.length) {
        return setError('server-error', out.shared
          ? 'This account only has servers that are shared with it. PosterLight needs the account that owns the Plex server.'
          : 'This Plex account has no Plex Media Server.');
      }
      for (var i = 0; i < out.servers.length; i++) {
        (function (server) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'server';
          button.appendChild(document.createTextNode(server.name));
          button.onclick = function () { choose(server, button); };
          list.appendChild(button);
        })(out.servers[i]);
      }
      if (out.servers.length === 1) choose(out.servers[0], list.firstChild);
    });
  }

  // ---- wait for the sign-in ----

  function waitFor(pinId, startedAt) {
    stopTimer();
    connect.checkPin(pinId, function (err, token) {
      if (token) return showServers(token);
      if (new Date().getTime() - startedAt > CODE_LIFE_MS) return startLink();   // the code ran out: show a new one
      // An error here is usually a moment without Wi-Fi. Keep trying.
      timer = window.setTimeout(function () { waitFor(pinId, startedAt); }, CHECK_MS);
    });
  }

  function startLink() {
    stopTimer();
    showStep('step-start');
    setError('start-error', null);
    show(byId('code-box'), false);
    show(byId('start-text'), true);
    connect.createLinkCode(function (err, pin) {
      if (err) return setError('start-error', MESSAGES.plex);
      show(byId('start-text'), false);
      byId('link-code').textContent = pin.code;
      show(byId('code-box'), true);
      waitFor(pin.id, new Date().getTime());
    });
  }

  byId('redirect-go').onclick = function () {
    var here = window.location.href.split('?')[0].split('#')[0];
    byId('redirect-go').disabled = true;
    connect.createRedirect(here, function (err, pin) {
      byId('redirect-go').disabled = false;
      if (err) return setError('start-error', MESSAGES.plex);
      try { window.sessionStorage.setItem(PENDING_KEY, String(pin.id)); } catch (e) { /* the pin is also in the return address */ }
      window.location.href = pin.authUrl;
    });
  };

  byId('start-over').onclick = startLink;
  byId('sign-out').onclick = function () {
    web.storage.removeItem('posterlight.web');
    startLink();
  };

  // ---- start ----

  var returned = param('pin');
  var saved = null;
  try { saved = JSON.parse(web.storage.getItem('posterlight.web')); } catch (e) { /* nothing saved */ }

  if (returned) {
    // Back from Plex's sign-in page.
    showStep('step-start');
    show(byId('start-text'), true);
    byId('start-text').textContent = 'Finishing the sign-in.';
    waitFor(returned, new Date().getTime());
  } else if (saved && saved.token && !param('change')) {
    showDone(saved.serverName);
  } else {
    startLink();
  }
})();
