'use strict';
// Chooses which facts a title gets. Pure functions: the same input always gives the same picks,
// so every screen that follows the same title shows the same facts.

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
  var rand = randomFrom(hash(String(seedText)));
  for (var i = out.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return out;
}

function pickMovieFacts(facts, ratingKey) {
  return shuffled(facts, 'movie|' + ratingKey).slice(0, MOVIE_FACTS);
}

// For the web app, which keeps no shared record of what was shown.
// The show's facts are put in one fixed order, and each episode takes the next 3 from it.
// Episodes watched in order therefore see new facts until the pool runs out.
function pickEpisodeFactsStateless(pool, showKey, seasonNumber, episodeNumber) {
  var count = Math.min(EPISODE_FACTS, pool.length);
  if (!count) return [];
  var order = shuffled(pool, 'show|' + showKey);
  var season = seasonNumber > 0 ? seasonNumber : 1;
  var episode = episodeNumber > 0 ? episodeNumber : 1;
  var start = (EPISODE_FACTS * (episode - 1) + 13 * EPISODE_FACTS * (season - 1)) % order.length;
  var out = [];
  for (var i = 0; i < count; i++) out.push(order[(start + i) % order.length]);
  return out;
}

module.exports = {
  MOVIE_FACTS: MOVIE_FACTS,
  EPISODE_FACTS: EPISODE_FACTS,
  shuffled: shuffled,
  pickMovieFacts: pickMovieFacts,
  pickEpisodeFactsStateless: pickEpisodeFactsStateless
};
