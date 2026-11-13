'use strict';
// Remembers what each Plex player is doing and answers one question:
// "what should a device that follows this player show right now?"
// It never reads the real clock. The caller passes `now`.

var SEEK_MS = 5000;

function createTracker(options) {
  var now = options.now;
  var pauseGraceMs = options.pauseGraceMs;
  var fullBrightMs = options.fullBrightMs;

  var entries = {};   // playerId -> entry
  var order = [];     // playerIds in the order Plex last listed them
  var seen = {};      // playerId -> name, for the setup screen
  var plexOk = true;

  function isPaused(session) {
    return session.playerState === 'paused';
  }

  function update(sessions) {
    if (!sessions) {
      plexOk = false;
      return;
    }
    plexOk = true;
    var t = now();
    var next = {};
    var nextOrder = [];
    sessions.forEach(function (session) {
      var id = session.playerId;
      var identity = id + '|' + session.ratingKey;
      var old = entries[id];
      var entry;
      if (old && old.identity === identity) {
        entry = old;
        var stateChanged = isPaused(old.session) !== isPaused(session);
        var reportChanged = session.viewOffsetMs !== old.session.viewOffsetMs;
        // Plex reports the position only every few seconds. A small gap between its number and
        // our estimate is normal drift, so we keep the estimate and the offset never steps back.
        // A gap of SEEK_MS or more is a seek.
        var isSeek = reportChanged && Math.abs(session.viewOffsetMs - offsetOf(old, t)) >= SEEK_MS;
        if (stateChanged || isSeek || (reportChanged && isPaused(session))) {
          entry.baseOffset = session.viewOffsetMs;
          entry.baseAt = t;
        }
        if (!isPaused(session)) entry.pausedSince = null;
        else if (entry.pausedSince === null) entry.pausedSince = t;
        entry.session = session;
      } else {
        entry = {
          identity: identity,
          session: session,
          startedAt: t,
          baseOffset: session.viewOffsetMs,
          baseAt: t,
          pausedSince: isPaused(session) ? t : null
        };
      }
      if (!next[id]) nextOrder.push(id);
      next[id] = entry;
      seen[id] = session.playerName;
    });
    entries = next;
    order = nextOrder;
  }

  function offsetOf(entry, t) {
    if (isPaused(entry.session)) return entry.baseOffset;
    var offset = entry.baseOffset + (t - entry.baseAt);
    var duration = entry.session.durationMs;
    return duration > 0 ? Math.min(offset, duration) : offset;
  }

  function pick(playerId) {
    if (playerId !== 'any') {
      if (entries[playerId]) return entries[playerId];
      // A device may also name the player, as in ?player=Living Room
      var wanted = String(playerId).toLowerCase();
      for (var n = 0; n < order.length; n++) {
        if (String(entries[order[n]].session.playerName).toLowerCase() === wanted) return entries[order[n]];
      }
      return null;
    }
    var first = null;
    for (var i = 0; i < order.length; i++) {
      var entry = entries[order[i]];
      if (!isPaused(entry.session)) return entry;
      if (!first) first = entry;
    }
    return first;
  }

  function idleView() {
    return { plexOk: plexOk, state: 'idle', brightness: 'dim', session: null, offsetMs: 0, startedAt: null };
  }

  function view(playerId) {
    var t = now();
    var entry = pick(playerId);
    if (!entry) return idleView();
    var offsetMs = offsetOf(entry, t);
    var duration = entry.session.durationMs;
    // While Plex is unreachable we keep the last screen, but not past the end of the title.
    if (!plexOk && duration > 0 && offsetMs >= duration) return idleView();
    var paused = entry.pausedSince !== null && t - entry.pausedSince >= pauseGraceMs;
    return {
      plexOk: plexOk,
      state: paused ? 'intermission' : 'playing',
      brightness: t - entry.startedAt < fullBrightMs ? 'full' : 'dim',
      session: entry.session,
      offsetMs: offsetMs,
      startedAt: entry.startedAt
    };
  }

  function players() {
    return Object.keys(seen).map(function (id) {
      return { id: id, name: seen[id], active: !!entries[id] };
    }).sort(function (a, b) {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
  }

  function loadPlayers(list) {
    (Array.isArray(list) ? list : []).forEach(function (p) {
      if (p && p.id && !seen[p.id]) seen[p.id] = String(p.name || p.id);
    });
  }

  return { update: update, view: view, players: players, loadPlayers: loadPlayers };
}

module.exports = { createTracker: createTracker };
