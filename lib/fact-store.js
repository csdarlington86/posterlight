'use strict';
// Reads the pre-written fact files and chooses which facts a title gets.
//   Movies:   up to 15 facts, in an order fixed by the movie's Plex id.
//   Episodes: 3 facts from the show's pool. A fact is not reused until the pool runs out.
var fs = require('fs');
var path = require('path');
var slugify = require('./slug').slugify;
var picker = require('./fact-picker');
var shuffled = picker.shuffled;

var MOVIE_FACTS = picker.MOVIE_FACTS;
var EPISODE_FACTS = picker.EPISODE_FACTS;
var ID_INDEX_MS = 60000;   // how long the id index is trusted before the folder is read again

function createFactStore(options) {
  var factsDir = options.factsDir;
  var statePath = options.statePath;
  var warn = options.warn || function (msg) { console.warn(msg); };
  var warned = {};
  var state = null;

  function readFacts(file) {
    var text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (e) {
      return null;
    }
    try {
      var json = JSON.parse(text);
      var facts = (json && Array.isArray(json.facts) ? json.facts : []).filter(function (f) {
        return typeof f === 'string' && f.trim() !== '';
      }).map(function (f) { return f.trim(); });
      return facts.length ? facts : null;
    } catch (e) {
      if (!warned[file]) {
        warned[file] = true;
        warn('Fact file is not valid JSON and was skipped: ' + file);
      }
      return null;
    }
  }

  function loadState() {
    if (state) return state;
    try {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (e) {
      state = {};
    }
    if (!state || typeof state !== 'object' || Array.isArray(state)) state = {};
    return state;
  }

  function saveState() {
    try {
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      fs.writeFileSync(statePath, JSON.stringify(state));
    } catch (e) {
      warn('Could not save fact state: ' + e.message);
    }
  }

  // ---- lookup by external id (imdb://tt..., tmdb://..., tvdb://...) ----
  // File names follow the English title, but a title in Plex depends on the user's language.
  // An id is the same everywhere, so files that list "ids" match any library.
  var idIndex = { movies: null, shows: null };
  var idIndexAt = { movies: 0, shows: 0 };

  function buildIdIndex(kind) {
    var index = {};
    var names = [];
    try {
      names = fs.readdirSync(path.join(factsDir, kind));
    } catch (e) { /* no folder: no ids */ }
    names.forEach(function (name) {
      if (!/\.json$/.test(name)) return;
      var file = path.join(factsDir, kind, name);
      try {
        var json = JSON.parse(fs.readFileSync(file, 'utf8'));
        (json && Array.isArray(json.ids) ? json.ids : []).forEach(function (id) {
          if (typeof id === 'string' && id) index[id.toLowerCase()] = file;
        });
      } catch (e) { /* readFacts reports a bad file when it is used by name */ }
    });
    return index;
  }

  function fileById(kind, guids) {
    if (!guids || !guids.length) return null;
    var t = Date.now();
    if (!idIndex[kind] || t - idIndexAt[kind] > ID_INDEX_MS) {
      idIndex[kind] = buildIdIndex(kind);
      idIndexAt[kind] = t;
    }
    for (var i = 0; i < guids.length; i++) {
      var key = String(guids[i]).toLowerCase();
      if (Object.prototype.hasOwnProperty.call(idIndex[kind], key)) return idIndex[kind][key];
    }
    return null;
  }

  function findFacts(kind, guids, names) {
    var byId = fileById(kind, guids);
    var facts = byId ? readFacts(byId) : null;
    for (var i = 0; !facts && i < names.length; i++) {
      facts = readFacts(path.join(factsDir, kind, names[i] + '.json'));
    }
    return facts;
  }

  function movieFacts(session, guids) {
    var slug = slugify(session.title);
    var names = [];
    if (slug && session.year) names.push(slug + '-' + session.year);
    if (slug) names.push(slug);
    var facts = findFacts('movies', guids, names);
    if (!facts) return null;
    return shuffled(facts, 'movie|' + session.ratingKey).slice(0, MOVIE_FACTS);
  }

  function episodeFacts(session, guids) {
    var titleSlug = slugify(session.showTitle);
    var pool = findFacts('shows', guids, titleSlug ? [titleSlug] : []);
    if (!pool) return null;
    // The pool state is kept per show. Prefer a stable id as its key.
    var slug = (guids && guids.length ? String(guids[0]).toLowerCase() : '') || titleSlug;
    if (fileById('shows', guids)) slug = path.basename(fileById('shows', guids), '.json');

    var all = loadState();
    var show = all[slug];
    if (!show || typeof show !== 'object') show = all[slug] = {};
    if (!Array.isArray(show.used)) show.used = [];
    if (!show.episodes || typeof show.episodes !== 'object') show.episodes = {};

    function inPool(i) { return typeof i === 'number' && i >= 0 && i < pool.length; }

    var picked = show.episodes[session.ratingKey];
    if (!Array.isArray(picked) || !picked.length || !picked.every(inPool)) {
      var want = Math.min(EPISODE_FACTS, pool.length);
      var indexes = pool.map(function (f, i) { return i; });
      var seed = 'episode|' + session.ratingKey;
      show.used = show.used.filter(inPool);
      picked = shuffled(indexes.filter(function (i) { return show.used.indexOf(i) === -1; }), seed).slice(0, want);
      if (picked.length < want) {
        // The pool ran out. Start it again, without repeating a fact inside this episode.
        show.used = [];
        var fresh = shuffled(indexes.filter(function (i) { return picked.indexOf(i) === -1; }), seed + '|refill');
        picked = picked.concat(fresh.slice(0, want - picked.length));
      }
      show.used = show.used.concat(picked.filter(function (i) { return show.used.indexOf(i) === -1; }));
      show.episodes[session.ratingKey] = picked;
      saveState();
    }
    return picked.map(function (i) { return pool[i]; });
  }

  // `guids` is optional: the external ids of the movie, or of the show for an episode.
  function factsFor(session, guids) {
    if (!session) return null;
    if (session.type === 'movie') return movieFacts(session, guids);
    if (session.type === 'episode') return episodeFacts(session, guids);
    return null;
  }

  return { factsFor: factsFor };
}

module.exports = { createFactStore: createFactStore, MOVIE_FACTS: MOVIE_FACTS, EPISODE_FACTS: EPISODE_FACTS };
