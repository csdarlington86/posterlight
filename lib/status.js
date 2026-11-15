'use strict';
// Builds the JSON a device receives. Nothing from Plex leaves the helper
// except plain text and opaque image ids.
var MAX_CAST = 8;

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
    return { plexOk: view.plexOk, player: null, state: 'idle', brightness: 'dim', media: null };
  }
  var isTrack = session.type === 'track';
  var cast = [];
  if (!isTrack) {
    var full = deps.castFor ? deps.castFor(session) : null;
    cast = (full && full.length ? full : session.cast || []).slice(0, MAX_CAST).map(function (c) {
      return { name: c.name, role: c.role || '', imgId: deps.images.idFor(c.thumb) };
    });
  }
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
      posterId: deps.images.idFor(session.posterPath),
      posterShape: isTrack ? 'square' : 'portrait',
      cast: cast
    }
  };
}

module.exports = { buildStatus: buildStatus };
