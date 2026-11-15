'use strict';
// Canned statuses, so every screen can be checked without playing anything.
// Open the page with ?demo=<name>. The titles and people here are made up.

function movie(brightness) {
  return {
    plexOk: true, player: { id: 'demo', name: 'Demo Player' }, state: 'playing', brightness: brightness,
    media: {
      type: 'movie', title: 'Midnight at the Rialto', subtitle: '', year: 1954, rating: 'PG-13', runtimeMin: 117,
      posterId: 'demo-poster', posterShape: 'portrait'
    }
  };
}

var DEMOS = {
  'movie': function () { return movie('full'); },
  'movie-long': function () {
    var s = movie('full');
    s.media.title = 'The Extraordinarily Long and Winding Title of a Picture That Never Ends';
    s.media.rating = 'Not Rated';
    return s;
  },
  'tv': function () {
    return {
      plexOk: true, player: { id: 'demo', name: 'Demo Player' }, state: 'playing', brightness: 'full',
      media: {
        type: 'episode', title: 'The Balcony Club', subtitle: 'S2 · E5 · The Second Reel', year: 2021, rating: 'TV-14',
        runtimeMin: 48, posterId: 'demo-season', posterShape: 'portrait'
      }
    };
  },
  'music': function () {
    return {
      plexOk: true, player: { id: 'demo', name: 'Demo Player' }, state: 'playing', brightness: 'full',
      media: {
        type: 'track', title: 'Velvet Curtain Blues', subtitle: 'The Rialto Quartet · Late Show', year: 1959, rating: '',
        runtimeMin: 6, posterId: 'demo-album', posterShape: 'square'
      }
    };
  },
  'intermission': function () {
    var s = movie('dim');
    s.state = 'intermission';
    return s;
  },
  'coming-soon': function () {
    var s = movie('full');
    s.player = null; s.state = 'idle'; s.media.title = 'The Balcony Club'; s.media.posterId = 'demo-season';
    return s;
  },
  'idle': function () {
    return { plexOk: true, player: null, state: 'idle', brightness: 'dim', media: null };
  }
};

function demoStatus(name) {
  return Object.prototype.hasOwnProperty.call(DEMOS, name) ? DEMOS[name]() : null;
}

module.exports = { demoStatus: demoStatus, demoNames: Object.keys(DEMOS) };
