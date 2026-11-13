'use strict';
// Canned statuses, so every screen can be checked without playing anything.
// Open the page with ?demo=<name>. The titles and people here are made up.

var CAST = [
  { name: 'Vera Lindqvist', role: 'Nora Vale', imgId: 'demo-face-1' },
  { name: 'Marcus Oyelaran', role: 'The Projectionist', imgId: 'demo-face-2' },
  { name: 'June Castellano', role: 'Dottie', imgId: 'demo-face-3' },
  { name: 'Theo Brandt', role: 'Usher Finch', imgId: 'demo-face-4' },
  { name: 'Priya Raman', role: 'Inspector Hale', imgId: 'demo-face-5' },
  { name: 'Walt Kowalczyk', role: 'Mr. Abernathy', imgId: 'demo-face-6' },
  { name: 'Odessa Flynn', role: 'Ticket Girl', imgId: null },
  { name: 'Hiro Tanabe', role: 'The Stranger', imgId: 'demo-face-2' }
];

function movie(brightness, fact) {
  return {
    plexOk: true, player: { id: 'demo', name: 'Demo Player' }, state: 'playing', brightness: brightness,
    media: {
      type: 'movie', title: 'Midnight at the Rialto', subtitle: '', year: 1954, rating: 'PG-13', runtimeMin: 117,
      posterId: 'demo-poster', posterShape: 'portrait', cast: CAST
    },
    fact: fact || null
  };
}

var FACT = {
  index: 2, total: 15,
  text: 'This is a demo fact. Real facts come from the fact files and appear 15 times across a movie, each for about a minute.'
};

var DEMOS = {
  'movie': function () { return movie('full'); },
  'movie-fact': function () { return movie('dim', FACT); },
  'movie-fact-full': function () { return movie('full', FACT); },
  'movie-dim': function () { return movie('dim'); },
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
        runtimeMin: 48, posterId: 'demo-season', posterShape: 'portrait', cast: CAST.slice(0, 5)
      },
      fact: null
    };
  },
  'music': function () {
    return {
      plexOk: true, player: { id: 'demo', name: 'Demo Player' }, state: 'playing', brightness: 'full',
      media: {
        type: 'track', title: 'Velvet Curtain Blues', subtitle: 'The Rialto Quartet · Late Show', year: 1959, rating: '',
        runtimeMin: 6, posterId: 'demo-album', posterShape: 'square', cast: []
      },
      fact: null
    };
  },
  'intermission': function () {
    var s = movie('dim');
    s.state = 'intermission';
    return s;
  },
  'idle': function () {
    return { plexOk: true, player: null, state: 'idle', brightness: 'dim', media: null, fact: null };
  }
};

function demoStatus(name) {
  return Object.prototype.hasOwnProperty.call(DEMOS, name) ? DEMOS[name]() : null;
}

module.exports = { demoStatus: demoStatus, demoNames: Object.keys(DEMOS) };
