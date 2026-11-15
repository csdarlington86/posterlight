'use strict';
// Builds the JSON a device receives. Nothing from Plex leaves the helper
// except plain text and opaque image ids.
var ROTATE_MS = 5 * 60 * 1000;   // a different poster every 5 minutes

// The clock picks the poster, so every screen shows the same one.
function slotOf(deps) {
  return Math.floor((deps.now ? deps.now() : Date.now()) / ROTATE_MS);
}

// While a title plays, the poster rotates through the other posters Plex has for it.
function posterOf(session, deps) {
  var more = deps.postersFor ? deps.postersFor(session) : null;
  if (!more || !more.length || !session.posterPath) return session.posterPath;
  var all = [session.posterPath].concat(more);
  return all[slotOf(deps) % all.length];
}

// With nothing playing, the poster rotates through movies in the library.
function idleMedia(deps) {
  var list = deps.library ? deps.library() : null;
  if (!list || !list.length) return null;
  var item = list[(slotOf(deps) * 7919) % list.length];   // a large step, so the order looks shuffled
  return {
    type: 'movie', title: item.title, subtitle: '', year: item.year || null, rating: item.contentRating || '',
    runtimeMin: Math.round((item.durationMs || 0) / 60000),
    posterId: deps.images.idFor(item.thumb), posterShape: 'portrait'
  };
}

function subtitleOf(session) {
  if (session.type === 'episode') {
    var parts = [];
    if (session.seasonNumber !== null && session.seasonNumber !== undefined) parts.push('S' + session.seasonNumber);
    if (session.episodeNumber !== null && session.episodeNumber !== undefined) parts.push('E' + session.episodeNumber);
    if (session.title) parts.push(session.title);
    return parts.join(' · ');
  }
  if (session.type === 'track') {
    return [session.artist, session.album].filter(Boolean).join(' · ');
  }
  return '';
}

function buildStatus(view, deps) {
  var session = view.session;
  if (view.state === 'idle' || !session) {
    return { plexOk: view.plexOk, player: null, state: 'idle', brightness: 'dim', media: idleMedia(deps) };
  }
  var isTrack = session.type === 'track';
  return {
    plexOk: view.plexOk,
    player: { id: session.playerId, name: session.playerName },
    state: view.state,
    brightness: view.brightness,
    media: {
      type: session.type,
      title: session.type === 'episode' && session.showTitle ? session.showTitle : session.title,
      subtitle: subtitleOf(session),
      year: session.year || null,
      rating: session.contentRating || '',
      runtimeMin: Math.round(session.durationMs / 60000),
      posterId: deps.images.idFor(posterOf(session, deps)),
      posterShape: isTrack ? 'square' : 'portrait'
    }
  };
}

module.exports = { buildStatus: buildStatus, ROTATE_MS: ROTATE_MS };
