'use strict';
// Turns Plex JSON into the plain shapes the rest of the helper uses.
// Every function here accepts bad input and returns an empty result.

var KNOWN_TYPES = { movie: true, episode: true, track: true };
var KNOWN_STATES = { playing: true, paused: true, buffering: true };

function metadataList(json) {
  var mc = json && typeof json === 'object' ? json.MediaContainer : null;
  var list = mc && Array.isArray(mc.Metadata) ? mc.Metadata : [];
  return list.filter(function (m) { return m && typeof m === 'object'; });
}

function str(v) {
  return v === undefined || v === null || v === '' ? null : String(v);
}

function num(v) {
  var n = Number(v);
  return isFinite(n) && n > 0 ? n : 0;
}

function intOrNull(v) {
  var n = parseInt(v, 10);
  return isFinite(n) ? n : null;
}

function tags(list) {
  if (!Array.isArray(list)) return [];
  return list.map(function (t) { return t && str(t.tag); }).filter(Boolean);
}

function castOf(m) {
  if (!m || !Array.isArray(m.Role)) return [];
  return m.Role.filter(function (r) { return r && str(r.tag); }).map(function (r) {
    return { name: String(r.tag), role: str(r.role), thumb: str(r.thumb) };
  });
}

function posterPath(m) {
  if (m.type === 'movie') return str(m.thumb);
  if (m.type === 'episode') return str(m.parentThumb) || str(m.grandparentThumb) || str(m.thumb);
  return str(m.parentThumb) || str(m.thumb);
}

function toSession(m) {
  var p = m.Player;
  if (!KNOWN_TYPES[m.type] || !p || typeof p !== 'object' || !str(p.machineIdentifier)) return null;
  var isEpisode = m.type === 'episode';
  var isTrack = m.type === 'track';
  return {
    playerId: String(p.machineIdentifier),
    playerName: str(p.title) || str(p.product) || 'Plex player',
    playerState: KNOWN_STATES[p.state] ? p.state : 'playing',
    type: m.type,
    ratingKey: str(m.ratingKey) || '',
    title: str(m.title) || '',
    year: intOrNull(m.year) || (isTrack ? intOrNull(m.parentYear) : null),
    contentRating: str(m.contentRating),
    durationMs: num(m.duration),
    viewOffsetMs: num(m.viewOffset),
    showTitle: isEpisode ? str(m.grandparentTitle) : null,
    seasonNumber: isEpisode ? intOrNull(m.parentIndex) : null,
    episodeNumber: isEpisode ? intOrNull(m.index) : null,
    showRatingKey: isEpisode ? str(m.grandparentRatingKey) : null,
    artist: isTrack ? str(m.grandparentTitle) : null,
    album: isTrack ? str(m.parentTitle) : null,
    studio: str(m.studio),
    directors: tags(m.Director),
    cast: isTrack ? [] : castOf(m),
    posterPath: posterPath(m)
  };
}

function parseSessions(json) {
  return metadataList(json).map(toSession).filter(Boolean);
}

function parseLibraryItems(json) {
  return metadataList(json).filter(function (m) { return str(m.title); }).map(function (m) {
    return {
      ratingKey: str(m.ratingKey) || '',
      type: str(m.type) || '',
      title: String(m.title),
      year: intOrNull(m.year),
      studio: str(m.studio),
      directors: tags(m.Director),
      cast: tags(m.Role)
    };
  });
}

// Reads the full cast from a /library/metadata/<key> response.
function parseCast(json) {
  return castOf(metadataList(json)[0]);
}

// Reads the external ids (IMDb, TMDB, TVDB) from a /library/metadata/<key> response.
// These ids are the same in every language, so a shared fact file can match any library.
function parseGuids(json) {
  var m = metadataList(json)[0];
  if (!m || !Array.isArray(m.Guid)) return [];
  return m.Guid.map(function (g) { return g && str(g.id); }).filter(Boolean);
}

module.exports = { parseGuids: parseGuids, parseSessions: parseSessions, parseLibraryItems: parseLibraryItems, parseCast: parseCast };
