/* PosterLight setup page. Talks only to the helper. The helper talks to Plex. */
(function () {
  'use strict';

  var CHECK_MS = 2000;
  var code = '';
  var checkTimer = null;

  function byId(id) { return document.getElementById(id); }

  var MESSAGES = {
    'code-needed': 'Type the 6-digit setup code from the PosterLight window.',
    'code-wrong': 'That code does not match. Check the PosterLight window and try again.',
    'locked': 'Too many wrong codes. Restart PosterLight on the helper computer to get a new code.',
    'unreachable': 'The helper computer could not reach that Plex server. Check that Plex is running.',
    'bad-address': 'The address must look like http://192.168.1.10:32400',
    'no-token': 'Type your Plex token.',
    'plex-failed': 'Plex did not answer. Check the internet connection and try again.',
    'network': 'The PosterLight helper did not answer. Check that it is still running.'
  };

  function message(error) {
    return MESSAGES[error] || 'Something went wrong. Try again.';
  }

  // Sends one setup step to the helper. done(error, json)
  function call(step, body, done) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'api/setup/' + step, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-PosterLight', '1');   // other websites cannot send this header
    if (code) xhr.setRequestHeader('X-Setup-Code', code);
    xhr.timeout = 30000;
    xhr.onload = function () {
      var json = null;
      try { json = JSON.parse(xhr.responseText); } catch (e) { /* handled below */ }
      if (xhr.status === 200 && json) done(null, json);
      else done((json && json.error) || 'network', json);
    };
    xhr.onerror = xhr.ontimeout = function () { done('network'); };
    xhr.send(JSON.stringify(body || {}));
  }

  function show(id) {
    var ids = ['step-code', 'step-signin', 'step-servers', 'step-done'];
    for (var i = 0; i < ids.length; i++) byId(ids[i]).hidden = ids[i] !== id;
  }

  function showError(id, error) {
    var node = byId(id);
    node.textContent = error ? message(error) : '';
    node.hidden = !error;
  }

  function stopChecking() {
    if (checkTimer) window.clearTimeout(checkTimer);
    checkTimer = null;
  }

  function showDone(name) {
    stopChecking();
    if (name) byId('done-text').textContent = 'The helper now follows "' + name + '".';
    var address = window.location.protocol + '//' + window.location.host + '/';
    byId('device-address').textContent = address;
    var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
    if (local) {
      byId('device-address').textContent = 'the address shown in the PosterLight window (it starts with http://192.168. or http://10.)';
    }
    show('step-done');
  }

  function showSignIn() {
    stopChecking();
    byId('signin-wait').hidden = true;
    byId('signin-go').disabled = false;
    showError('signin-error', null);
    show('step-signin');
  }

  // ---- start: is a code needed? is the helper already connected? ----

  function start() {
    call('status', {}, function (error, json) {
      if (error === 'code-needed' || error === 'code-wrong' || error === 'locked') {
        show('step-code');
        if (error !== 'code-needed' || code) showError('code-error', error);
        return;
      }
      if (error) {
        show('step-signin');
        showError('signin-error', error);
        return;
      }
      if (json.configured) showDone(null); else showSignIn();
    });
  }

  byId('code-go').onclick = function () {
    code = byId('code').value.replace(/\s+/g, '');
    showError('code-error', null);
    start();
  };
  byId('code').onkeydown = function (event) {
    if (event.key === 'Enter') byId('code-go').onclick();
  };

  // ---- sign in with Plex ----

  function check() {
    call('signin-check', {}, function (error, json) {
      if (error) {
        showSignIn();
        showError('signin-error', error === 'not-started' ? 'plex-failed' : error);
        return;
      }
      if (!json.signedIn) {
        checkTimer = window.setTimeout(check, CHECK_MS);
        return;
      }
      showServers(json.servers);
    });
  }

  byId('signin-go').onclick = function () {
    // Open the tab now, inside the click, so the browser does not block it as a pop-up.
    var tab = window.open('', '_blank');
    byId('signin-go').disabled = true;
    showError('signin-error', null);
    call('signin-start', {}, function (error, json) {
      if (error) {
        if (tab) tab.close();
        showSignIn();
        showError('signin-error', error);
        return;
      }
      if (tab) tab.location.href = json.authUrl;
      byId('signin-link').href = json.authUrl;
      byId('signin-wait').hidden = false;
      check();
    });
  };

  // ---- choose a server ----

  function choose(server, button) {
    showError('server-error', null);
    button.disabled = true;
    call('choose-server', { id: server.id }, function (error, json) {
      button.disabled = false;
      if (error) return showError('server-error', error);
      showDone(json.name);
    });
  }

  function showServers(servers) {
    stopChecking();
    var list = byId('server-list');
    while (list.firstChild) list.removeChild(list.firstChild);
    if (!servers.length) {
      show('step-servers');
      byId('server-error').textContent = 'This Plex account has no Plex Media Server. Sign in with the account that owns the server.';
      byId('server-error').hidden = false;
      return;
    }
    servers.forEach(function (server) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'server';
      button.appendChild(document.createTextNode(server.name));
      var small = document.createElement('small');
      small.textContent = server.owned ? 'Your server' : 'Shared with you';
      button.appendChild(small);
      button.onclick = function () { choose(server, button); };
      list.appendChild(button);
    });
    show('step-servers');
    if (servers.length === 1) choose(servers[0], list.firstChild);
  }

  // ---- by hand ----

  byId('manual-go').onclick = function () {
    showError('manual-error', null);
    byId('manual-go').disabled = true;
    call('manual', { plexUrl: byId('manual-url').value, plexToken: byId('manual-token').value }, function (error) {
      byId('manual-go').disabled = false;
      if (error) return showError('manual-error', error);
      byId('manual-token').value = '';
      showDone(null);
    });
  };

  byId('again').onclick = showSignIn;

  start();
})();
