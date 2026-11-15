/* PosterLight page script. Plain ES5 for iOS 12 Safari: var, function, XMLHttpRequest.
   Newer browser features (Screen Wake Lock) are used only after a feature check. */
(function () {
  'use strict';

  var L = window.PosterLogic;
  var POLL_MS = 2000;
  var REQUEST_TIMEOUT_MS = 8000;
  var PLAYERS_REFRESH_MS = 5000;
  var FAILURES_BEFORE_DOT = 3;
  var STORAGE_KEY = 'posterlight.player';
  var SCREENS = ['setup', 'unconfigured', 'idle', 'now', 'intermission'];

  function byId(id) { return document.getElementById(id); }

  var el = {
    app: byId('app'), fader: byId('fader'), gear: byId('gear'), controls: byId('controls'), fullscreen: byId('fullscreen'), offline: byId('offline'),
    playerList: byId('player-list'), setupHint: byId('setup-hint'),
    posterArea: byId('poster-area'), frame: byId('frame'), frameInner: byId('frame-inner'), glow: byId('poster-glow'), poster: byId('poster'), posterFallback: byId('poster-fallback'),
    marqueeText: byId('marquee-text'), title: byId('title'), subtitle: byId('subtitle'), rating: byId('rating'), runtime: byId('runtime'), year: byId('year'),
    card: byId('card'), cardCast: byId('card-cast'),
    intermissionTitle: byId('intermission-title')
  };

  var demo = L.queryParam(window.location.search, 'demo');
  // Set by the website builds (web app and demo). Null when a helper serves this page.
  var local = window.PosterLightLocal || null;

  var state = {
    player: null,          // the Plex player this device follows, or 'any'
    status: null,          // last good answer from the helper
    lastTapMs: 0,
    failures: 0,
    shape: null,
    screen: null,
    layout: null,
    posterKey: '',
    castKey: '',
    mediaKey: '',
    playersKey: null,
    playersTimer: null
  };

  // ---------- small helpers ----------

  function setClass(node, name, on) {
    var has = (' ' + node.className + ' ').indexOf(' ' + name + ' ') !== -1;
    if (on && !has) node.className = node.className ? node.className + ' ' + name : name;
    if (!on && has) node.className = (' ' + node.className + ' ').replace(' ' + name + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  function setText(node, text) {
    text = text === null || text === undefined ? '' : String(text);
    if (node.textContent !== text) node.textContent = text;
  }

  function readStored() {
    try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function writeStored(value) {
    try {
      if (value === null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, value);
    } catch (e) { /* private mode: the choice lasts until the page closes */ }
  }

  function getJson(url, done) {
    var finished = false;
    function finish(err, data) {
      if (finished) return;
      finished = true;
      done(err, data);
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = REQUEST_TIMEOUT_MS;
    xhr.onload = function () {
      if (xhr.status !== 200) return finish(new Error('status ' + xhr.status));
      var data;
      try { data = JSON.parse(xhr.responseText); } catch (e) { return finish(e); }
      finish(null, data);
    };
    xhr.onerror = function () { finish(new Error('network')); };
    xhr.ontimeout = function () { finish(new Error('timeout')); };
    xhr.onabort = function () { finish(new Error('abort')); };
    try { xhr.send(); } catch (e) { finish(e); }
  }

  // ---------- bulbs ----------

  function buildBulbRow(count, extraClass, group) {
    var row = document.createElement('div');
    row.className = 'bulb-row' + (extraClass ? ' ' + extraClass : '');
    for (var i = 0; i < count; i++) {
      var bulb = document.createElement('i');
      if (group !== null && i % 3 === group) bulb.className = 'on';
      row.appendChild(bulb);
    }
    return row;
  }

  // Each strip is one static row of dim bulbs plus three "lit" rows that fade in turn.
  // Only those three rows animate, so an old tablet has very little to composite.
  function buildBulbs() {
    var strips = document.querySelectorAll('[data-bulbs]');
    var spacing = (state.layout ? state.layout.baseFont : 18) * 1.5;
    for (var i = 0; i < strips.length; i++) {
      var strip = strips[i];
      var count = Math.max(5, Math.round(strip.offsetWidth / spacing));
      if (strip.getAttribute('data-count') === String(count)) continue;
      strip.setAttribute('data-count', String(count));
      while (strip.firstChild) strip.removeChild(strip.firstChild);
      strip.appendChild(buildBulbRow(count, '', null));
      if (strip.getAttribute('data-bulbs') === 'chase') {
        for (var g = 0; g < 3; g++) strip.appendChild(buildBulbRow(count, 'lit g' + g, g));
      }
    }
  }

  // ---------- layout ----------

  function currentShape() {
    var media = state.status && state.status.media;
    return media && media.posterShape === 'square' ? 'square' : 'portrait';
  }

  function applyLayout(layout) {
    state.layout = layout;
    el.app.style.fontSize = layout.baseFont + 'px';
    setClass(el.app, 'is-landscape', layout.orientation === 'landscape');
    setClass(el.app, 'is-portrait', layout.orientation === 'portrait');
    el.frameInner.style.width = layout.posterW + 'px';
    el.frameInner.style.height = layout.posterH + 'px';
    var glowW = Math.round(layout.posterW * 1.7);
    var glowH = Math.round(layout.posterH * 1.45);
    el.glow.style.width = glowW + 'px';
    el.glow.style.height = glowH + 'px';
    el.glow.style.marginLeft = (-glowW / 2) + 'px';
    el.glow.style.marginTop = (-glowH / 2) + 'px';
    buildBulbs();
    state.castKey = '';     // the number of headshots may have changed
    state.posterKey = '';   // the poster may need a different size
    render();
  }

  function updateLayout() {
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    var h = window.innerHeight || document.documentElement.clientHeight || 0;
    var next = L.computeLayout(w, h, currentShape());
    // Set the text size and the arrangement first. Then the title and the cast take their real height,
    // and the poster gets exactly the space that is left. Nothing can overlap.
    el.app.style.fontSize = next.baseFont + 'px';
    setClass(el.app, 'is-landscape', next.orientation === 'landscape');
    setClass(el.app, 'is-portrait', next.orientation === 'portrait');
    var edge = el.frame.offsetHeight - el.frameInner.offsetHeight;   // the frame around the poster
    var areaW = el.posterArea.clientWidth - edge;
    var areaH = el.posterArea.clientHeight - edge;
    // In landscape the poster has its own column. Keep a margin there, with room for the corner buttons.
    if (next.orientation === 'landscape') { areaW = areaW * 0.92; areaH = areaH - 5.2 * next.baseFont; }
    else areaH = areaH - 0.6 * next.baseFont;   // a small gap above the title
    if (areaW > 20 && areaH > 20) next = L.computeLayout(w, h, currentShape(), { w: areaW, h: areaH });
    var prev = state.layout;
    if (prev && prev.orientation === next.orientation && prev.posterW === next.posterW &&
        prev.posterH === next.posterH && prev.castCount === next.castCount && prev.baseFont === next.baseFont) {
      return;
    }
    if (prev && prev.orientation !== next.orientation) {
      // Rotation: fade out, rearrange, fade in. The page never reloads.
      setClass(el.fader, 'is-hidden', true);
      window.setTimeout(function () {
        applyLayout(next);
        setClass(el.fader, 'is-hidden', false);
      }, 240);
    } else {
      applyLayout(next);
    }
  }

  var layoutTimer = null;
  function scheduleLayout() {
    if (layoutTimer) window.clearTimeout(layoutTimer);
    layoutTimer = window.setTimeout(updateLayout, 120);
    // iOS 12 reports the new size late after a rotation, so check once more.
    window.setTimeout(updateLayout, 600);
  }

  // ---------- media: poster, titles, cast ----------

  function imageUrl(id, cssW, cssH) {
    var dpr = window.devicePixelRatio || 1;
    if (local) return local.imageUrl(id, L.imageSize(cssW, dpr), L.imageSize(cssH, dpr));
    return 'img/' + encodeURIComponent(id) + '?w=' + L.imageSize(cssW, dpr) + '&h=' + L.imageSize(cssH, dpr);
  }

  var posterTimer = null;
  function updatePoster(media) {
    var layout = state.layout;
    var key = (media.posterId || '') + '|' + layout.posterW + 'x' + layout.posterH;
    if (key === state.posterKey) return;
    var sameArt = state.posterKey.split('|')[0] === (media.posterId || '');
    state.posterKey = key;
    setText(el.posterFallback, media.title);
    if (posterTimer) { window.clearTimeout(posterTimer); posterTimer = null; }
    if (!media.posterId) {
      setClass(el.poster, 'is-loaded', false);
      el.poster.removeAttribute('src');
      return;
    }
    var src = imageUrl(media.posterId, layout.posterW, layout.posterH);
    el.poster.onload = function () { setClass(el.poster, 'is-loaded', true); };
    el.poster.onerror = function () { setClass(el.poster, 'is-loaded', false); };
    if (sameArt || !el.poster.getAttribute('src')) { el.poster.src = src; return; }
    // A different poster: fade the old one out, then load the new one. It fades in when it is ready.
    setClass(el.poster, 'is-loaded', false);
    posterTimer = window.setTimeout(function () { posterTimer = null; el.poster.src = src; }, 950);
  }

  function buildCastCell(person) {
    var cell = document.createElement('div');
    cell.className = 'cast-cell';
    var photo = document.createElement('div');
    photo.className = 'cast-photo';
    var initials = document.createElement('div');
    initials.className = 'cast-initials';
    initials.textContent = L.initials(person.name);
    photo.appendChild(initials);
    if (person.imgId) {
      var img = document.createElement('img');
      img.alt = '';
      img.onload = function () { img.className = 'is-loaded'; };
      img.src = imageUrl(person.imgId, 96, 96);
      photo.appendChild(img);
    }
    var name = document.createElement('div');
    name.className = 'cast-name';
    name.textContent = person.name;
    var role = document.createElement('div');
    role.className = 'cast-role';
    role.textContent = person.role || '';
    cell.appendChild(photo);
    cell.appendChild(name);
    cell.appendChild(role);
    return cell;
  }

  function updateCast(media) {
    var cast = (media.cast || []).slice(0, state.layout.castCount);
    var key = '';
    for (var i = 0; i < cast.length; i++) key += cast[i].name + '|' + (cast[i].imgId || '') + ';';
    if (key === state.castKey) return;
    state.castKey = key;
    while (el.cardCast.firstChild) el.cardCast.removeChild(el.cardCast.firstChild);
    for (var j = 0; j < cast.length; j++) el.cardCast.appendChild(buildCastCell(cast[j]));
  }

  function updateMedia(media) {
    var key = [media.type, media.title, media.subtitle, media.rating, media.runtimeMin, media.year].join('|');
    if (key !== state.mediaKey) {
      state.mediaKey = key;
      var title = media.title || '';
      setText(el.title, title);
      setClass(el.title, 'is-long', title.length > 24 && title.length <= 46);
      setClass(el.title, 'is-very-long', title.length > 46);
      setText(el.subtitle, media.subtitle);
      setText(el.rating, media.rating);
      setText(el.runtime, L.formatRuntime(media.runtimeMin));
      setText(el.year, media.year || '');
      setText(el.intermissionTitle, media.subtitle && media.type === 'episode' ? title + ' · ' + media.subtitle : title);
      updateLayout();   // the title block may have a new height
    }
    updatePoster(media);
    updateCast(media);
  }

  // ---------- screens ----------

  function showScreen(name) {
    if (name === state.screen) return;
    var previous = state.screen;
    state.screen = name;
    for (var i = 0; i < SCREENS.length; i++) {
      var node = byId('screen-' + SCREENS[i]);
      setClass(node, 'is-active', SCREENS[i] === name);
      setClass(node, 'is-leaving', SCREENS[i] === previous);
    }
    if (previous) {
      window.setTimeout(function () {
        if (state.screen !== previous) setClass(byId('screen-' + previous), 'is-leaving', false);
      }, 1000);
    }
    if (name === 'setup') startSetup(); else stopSetup();
  }

  function render() {
    if (!state.layout) return;
    var now = new Date().getTime();
    var status = state.status;
    var view = L.computeView(status, { nowMs: now, lastTapMs: state.lastTapMs, hasPlayer: !!state.player });

    // The poster shape (portrait or square) can change the layout.
    var shape = currentShape();
    if (shape !== state.shape) {
      state.shape = shape;
      updateLayout();
    }

    showScreen(view.screen);
    setText(el.marqueeText, view.sign);
    if ((view.screen === 'now' || view.screen === 'intermission') && status.media) updateMedia(status.media);

    setClass(el.card, 'is-shown', view.card !== 'hidden');
    setClass(el.cardCast, 'is-shown', view.card === 'cast');

    setClass(el.controls, 'is-shown', now - state.lastTapMs < L.CONTROLS_MS);
    el.gear.style.display = view.screen === 'setup' ? 'none' : '';
    var plexLost = !!status && status.plexOk === false;
    setClass(el.offline, 'is-shown', state.failures >= FAILURES_BEFORE_DOT || (plexLost && view.screen !== 'unconfigured'));
  }

  // ---------- talking to the helper ----------

  function poll() {
    // The website (web app and demo) brings its own data source and has no helper to ask.
    if (local) {
      state.failures = 0;
      window.setTimeout(poll, POLL_MS);
      try {
        state.status = local.status(state.player || 'any');
        render();
      } catch (e) { /* the next poll draws again */ }
      return;
    }
    // With no player chosen yet we still ask, to learn whether the helper itself is set up.
    var url = 'api/status?player=' + encodeURIComponent(state.player || 'any');
    if (demo) url += '&demo=' + encodeURIComponent(demo);
    getJson(url, function (err, data) {
      if (err || !data || typeof data !== 'object') {
        // Lost Wi-Fi or the helper is down: keep the last screen and keep trying.
        state.failures += 1;
      } else {
        state.failures = 0;
        state.status = data;
      }
      // Schedule the next request first. If drawing ever fails, the screen still recovers by itself.
      window.setTimeout(poll, POLL_MS);
      try { render(); } catch (e) { /* the next poll draws again */ }
    });
  }

  // ---------- setup screen ----------

  function choosePlayer(id) {
    state.player = id;
    writeStored(id);
    state.status = null;
    state.lastTapMs = new Date().getTime();
    render();
  }

  function playerButton(id, label, note, live, extraClass) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'player-button' + (extraClass ? ' ' + extraClass : '');
    if (live) {
      var dot = document.createElement('span');
      dot.className = 'live';
      button.appendChild(dot);
    }
    button.appendChild(document.createTextNode(label));
    if (note) {
      var small = document.createElement('small');
      small.textContent = note;
      button.appendChild(small);
    }
    button.onclick = function (event) {
      if (event && event.stopPropagation) event.stopPropagation();
      choosePlayer(id);
    };
    return button;
  }

  function renderPlayers(players) {
    var key = JSON.stringify(players);
    if (key === state.playersKey) return;
    state.playersKey = key;
    while (el.playerList.firstChild) el.playerList.removeChild(el.playerList.firstChild);
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      el.playerList.appendChild(playerButton(p.id, p.name, p.active ? 'Playing now' : 'Seen before', p.active, ''));
    }
    el.playerList.appendChild(playerButton('any', 'Any player', 'Show whatever is playing', false, 'is-any'));
    el.setupHint.style.display = players.length ? 'none' : '';
  }

  function loadPlayers() {
    if (local) {
      if (state.screen === 'setup') renderPlayers(local.players());
      return;
    }
    getJson('api/players', function (err, data) {
      if (state.screen !== 'setup') return;
      renderPlayers(!err && data && data.players && data.players.length ? data.players : []);
    });
  }

  function startSetup() {
    if (state.playersTimer) return;
    if (state.playersKey === null) renderPlayers([]);
    loadPlayers();
    state.playersTimer = window.setInterval(loadPlayers, PLAYERS_REFRESH_MS);
  }

  function stopSetup() {
    if (!state.playersTimer) return;
    window.clearInterval(state.playersTimer);
    state.playersTimer = null;
  }

  // ---------- keeping the screen on ----------

  var wakeLock = null;
  function requestWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock || document.visibilityState !== 'visible') return;
    try {
      navigator.wakeLock.request('screen').then(function (lock) {
        wakeLock = lock;
        lock.addEventListener('release', function () { wakeLock = null; });
      }, function () { /* refused, for example on low battery: the device setting still applies */ });
    } catch (e) { /* ignore */ }
  }

  // ---------- events ----------

  function onTap() {
    state.lastTapMs = new Date().getTime();
    requestWakeLock();
    render();
  }

  function insideScrollable(node) {
    while (node && node !== document.body) {
      if (node.className && (' ' + node.className + ' ').indexOf(' scrollable ') !== -1) return true;
      node = node.parentNode;
    }
    return false;
  }

  document.addEventListener('touchstart', onTap, false);
  document.addEventListener('mousedown', onTap, false);
  document.addEventListener('touchmove', function (event) {
    // Stops the rubber-band scroll of a home-screen web app. The setup list may still scroll.
    if (!insideScrollable(event.target)) event.preventDefault();
  }, { passive: false });

  el.gear.onclick = function (event) {
    if (event && event.stopPropagation) event.stopPropagation();
    writeStored(null);
    state.player = null;
    state.status = null;
    render();
  };

  // Full screen hides the browser bars. A home-screen app already has none, so the button hides there.
  var fsRoot = document.documentElement;
  var fsEnter = fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen;
  var fsExit = document.exitFullscreen || document.webkitExitFullscreen;
  if (fsEnter && fsExit && !window.navigator.standalone) {
    el.fullscreen.onclick = function (event) {
      if (event && event.stopPropagation) event.stopPropagation();
      try {
        var done = (document.fullscreenElement || document.webkitFullscreenElement) ? fsExit.call(document) : fsEnter.call(fsRoot);
        if (done && done.then) done.then(null, function () { /* the browser refused */ });
      } catch (e) { /* the browser refused */ }
    };
  } else {
    el.fullscreen.style.display = 'none';
  }

  window.addEventListener('resize', scheduleLayout, false);
  window.addEventListener('orientationchange', scheduleLayout, false);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') requestWakeLock();
  }, false);

  // ---------- start ----------

  state.player = L.pickPlayer(window.location.search, readStored());
  if (!state.player && (demo || (local && local.demo))) state.player = 'any';   // demo pages skip the setup screen

  if (local && local.setupUrl) {
    byId('open-setup').href = local.setupUrl;
    if (local.setupHint) byId('unconfigured-hint').textContent = local.setupHint;
  }
  if (local && local.accountUrl) {
    byId('account-link').href = local.accountUrl;
    byId('account-link').style.display = '';
  }

  updateLayout();
  requestWakeLock();
  poll();
  window.setInterval(function () {
    // Some browsers (iOS 12 home-screen apps among them) can miss a resize event after a rotation.
    // Checking the size once a second costs almost nothing and makes rotation reliable.
    updateLayout();
    render();   // also lets the corner buttons hide
  }, 1000);
  // Web fonts change text widths when they arrive, so measure the bulb strips again.
  window.setTimeout(function () { buildBulbs(); }, 1500);
})();
