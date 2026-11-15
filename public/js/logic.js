/* PosterLight view logic. Plain ES5: it must run on iOS 12 Safari.
   No DOM in this file, so the same code runs under the Node tests. */
(function (root) {
  'use strict';

  var TAP_WAKE_MS = 30000;
  var CONTROLS_MS = 10000;   // the corner buttons hide this long after the last tap

  // Decides which screen shows, how dark the overlay is, and what the card holds.
  function computeView(status, ctx) {
    var awake = ctx.nowMs - ctx.lastTapMs < TAP_WAKE_MS;
    var screen;
    if (status && status.state === 'setup') screen = 'unconfigured';   // the helper has no Plex settings yet
    else if (!ctx.hasPlayer) screen = 'setup';
    else if (!status || status.state === 'idle' || !status.media) screen = 'idle';
    else if (status.state === 'intermission') screen = 'intermission';
    else screen = 'now';

    var isNow = screen === 'now';
    var isMusic = isNow && status.media.type === 'track';
    var full = awake || screen === 'setup' || screen === 'unconfigured' || (screen !== 'idle' && status.brightness === 'full');

    // 'soft' is the in-between level, used for the intermission sign.
    var overlay = full ? 'full' : (screen === 'intermission' ? 'soft' : 'dim');
    var card = 'hidden';
    if (isNow && !isMusic && full && status.media.cast && status.media.cast.length) card = 'cast';

    return { screen: screen, overlay: overlay, card: card };
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  // Sizes the poster so it always keeps its shape and is never cropped.
  // The box is the free space measured on the page. Without it, a share of the screen is used.
  function computeLayout(w, h, posterShape, box) {
    var landscape = w > h;
    var ratio = posterShape === 'square' ? 1 : 2 / 3;   // width / height
    var boxW = box ? box.w : (landscape ? 0.42 * w : 0.86 * w);
    var boxH = box ? box.h : (landscape ? 0.84 * h : 0.52 * h);
    var posterH = Math.max(1, Math.floor(Math.min(boxH, boxW / ratio)));
    if (ratio !== 1) posterH = Math.max(3, posterH - (posterH % 3));  // keeps 2:3 exact in whole pixels
    var posterW = Math.max(1, Math.round(posterH * ratio));

    var small = Math.min(w, h);
    var cardW = landscape ? 0.5 * w : 0.9 * w;
    var cell = small >= 600 ? 120 : 84;   // room for a name under each headshot

    return {
      orientation: landscape ? 'landscape' : 'portrait',
      posterW: posterW,
      posterH: posterH,
      castCount: clamp(Math.floor(cardW / cell), 3, 8),
      baseFont: clamp(small / 36, 15, 26)
    };
  }

  function queryParam(search, name) {
    var parts = String(search || '').replace(/^\?/, '').split('&');
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf('=');
      var key = eq === -1 ? parts[i] : parts[i].slice(0, eq);
      if (key !== name) continue;
      try {
        var value = decodeURIComponent((eq === -1 ? '' : parts[i].slice(eq + 1)).replace(/\+/g, ' '));
        return value === '' ? null : value;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function pickPlayer(search, stored) {
    return queryParam(search, 'player') || stored || null;
  }

  // Asks the helper for an image no larger than the device needs.
  function imageSize(cssPx, dpr) {
    return Math.ceil(cssPx * Math.min(dpr || 1, 2) / 100) * 100;
  }

  function formatRuntime(minutes) {
    minutes = Math.round(minutes || 0);
    if (minutes <= 0) return '';
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    if (!h) return m + 'm';
    return m ? h + 'h ' + m + 'm' : h + 'h';
  }

  function initials(name) {
    var words = String(name || '').replace(/^\s+|\s+$/g, '').split(/\s+/);
    if (!words[0]) return '';
    var first = words[0].charAt(0);
    var last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
  }

  var api = {
    TAP_WAKE_MS: TAP_WAKE_MS,
    CONTROLS_MS: CONTROLS_MS,
    computeView: computeView,
    computeLayout: computeLayout,
    queryParam: queryParam,
    pickPlayer: pickPlayer,
    imageSize: imageSize,
    formatRuntime: formatRuntime,
    initials: initials
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PosterLogic = api;
})(this);
