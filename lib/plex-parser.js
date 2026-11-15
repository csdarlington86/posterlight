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

// Release words that mark a file name, for example "Movie 1981 1080p BluRay x265-GROUP".
var RELEASE_TAG = /[\s.(\[_-]+(480p|576p|720p|1080p|2160p|4k|uhd|blu-?ray|b[dr]rip|web-?(dl|rip)|hdtv|dvdrip|remux|x26[45]|h\.?26[45]|hevc|xvid|divx)\b.*$/i;
var YEAR_IN_BRACKETS = /[\s._-]*[(\[](19|20)\d\d[)\]].*$/;
var YEAR_THEN_MORE = /[\s._-]+(19|20)\d\d[\s._-]+.*$/;
var YEAR_AT_END = /[\s._-]+(19|20)\d\d$/;

// Turns a file name into a plain title: no folder, no release words, no year.
function cleanTitle(text) {
  var name = String(text || '').replace(/^.*[\\\/]/, '');
  function cut(t, pattern) { return t.replace(pattern, '') || t; }
  var t = cut(name, RELEASE_TAG);
  var hadTag = t !== name;
  t = cut(cut(t, YEAR_IN_BRACKETS), YEAR_THEN_MORE);
  if (hadTag) t = cut(t, YEAR_AT_END);
  if (!/\s/.test(t)) t = t.replace(/[._]+/g, ' ');
  return t.replace(/^\s+|\s+$/g, '');
}

function fileNameOf(m) {
  var media = Array.isArray(m.Media) ? m.Media[0] : null;
  var part = media && Array.isArray(media.Part) ? media.Part[0] : null;
  var file = part && str(part.file);
  return file ? file.replace(/^.*[\\\/]/, '').replace(/\.[A-Za-z0-9]{2,5}$/, '') : null;
}

// The Plex title. Plex uses the file name for an item it could not match, so that is tidied.
// With no title at all, the file name is used.
function titleOf(m) {
  var title = str(m.title);
  if (title) return RELEASE_TAG.test(title) ? cleanTitle(title) : title;
  var file = fileNameOf(m);
  return file ? cleanTitle(file) : '';
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
    title: titleOf(m),
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
    posterPath: posterPath(m)
  };
}

function parseSessions(json) {
  return metadataList(json).map(toSession).filter(Boolean);
}

var MAX_POSTERS = 8;

// Reads the other posters of a title from a /library/metadata/<key>/posters response.
// The poster in use is left out, because the session already has it.
function parsePosters(json) {
  return metadataList(json).filter(function (m) { return !m.selected; }).map(function (m) {
    return str(m.thumb) || str(m.key);
  }).filter(Boolean).slice(0, MAX_POSTERS);
}

// Reads the keys of the movie libraries from a /library/sections response.
function parseMovieSections(json) {
  var mc = json && typeof json === 'object' ? json.MediaContainer : null;
  var dirs = mc && Array.isArray(mc.Directory) ? mc.Directory : [];
  return dirs.filter(function (d) { return d && d.type === 'movie' && str(d.key); }).map(function (d) { return String(d.key); });
}

// Reads movies that have a poster from a /library/sections/<key>/all response.
function parseLibraryMovies(json) {
  return metadataList(json).filter(function (m) { return str(m.title) && str(m.thumb); }).map(function (m) {
    return { title: titleOf(m), year: intOrNull(m.year), contentRating: str(m.contentRating), durationMs: num(m.duration), thumb: String(m.thumb) };
  });
}

module.exports = {
  parseSessions: parseSessions, cleanTitle: cleanTitle,
  parsePosters: parsePosters, parseMovieSections: parseMovieSections, parseLibraryMovies: parseLibraryMovies
};
