'use strict';
// Reads the pre-written fact files and chooses which facts a title gets.
//   Movies:   up to 15 facts, in an order fixed by the movie's Plex id.
//   Episodes: 3 facts from the show's pool. A fact is not reused until the pool runs out.
var fs = require('fs');
var path = require('path');
var slugify = require('./slug').slugify;

var MOVIE_FACTS = 15;
var EPISODE_FACTS = 3;

function hash(text) {
  var h = 2166136261;
  for (var i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Small seeded random generator (mulberry32), so picks are repeatable.
function randomFrom(seed) {
  var a = seed;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, seedText) {
  var out = list.slice();
  var rand = randomFrom(hash(seedText));
  for (var i = out.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return out;
}

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

  function movieFacts(session) {
    var slug = slugify(session.title);
    if (!slug) return null;
    var facts = null;
    if (session.year) facts = readFacts(path.join(factsDir, 'movies', slug + '-' + session.year + '.json'));
    if (!facts) facts = readFacts(path.join(factsDir, 'movies', slug + '.json'));
    if (!facts) return null;
    return shuffled(facts, 'movie|' + session.ratingKey).slice(0, MOVIE_FACTS);
  }

  function episodeFacts(session) {
    var slug = slugify(session.showTitle);
    if (!slug) return null;
    var pool = readFacts(path.join(factsDir, 'shows', slug + '.json'));
    if (!pool) return null;

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

  function factsFor(session) {
    if (!session) return null;
    if (session.type === 'movie') return movieFacts(session);
    if (session.type === 'episode') return episodeFacts(session);
    return null;
  }

  return { factsFor: factsFor };
}

module.exports = { createFactStore: createFactStore, MOVIE_FACTS: MOVIE_FACTS, EPISODE_FACTS: EPISODE_FACTS };
