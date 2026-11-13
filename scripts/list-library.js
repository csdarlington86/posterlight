'use strict';
// Lists the movies and shows in your Plex library and says which ones have no fact file yet.
// Run it with: npm run library
// It writes the full list to data/library.json. It never changes anything on your Plex server.
var fs = require('fs');
var path = require('path');
var slugify = require('../lib/slug').slugify;

var ROOT = path.join(__dirname, '..');

function byTitle(a, b) {
  var x = a.title.toLowerCase(), y = b.title.toLowerCase();
  return x < y ? -1 : x > y ? 1 : (a.year || 0) - (b.year || 0);
}

function summarize(items, factsDir) {
  function entry(item, kind) {
    var slug = slugify(item.title);
    var name = kind === 'movies' && item.year ? slug + '-' + item.year + '.json' : slug + '.json';
    return {
      title: item.title,
      year: item.year || null,
      file: 'facts/' + kind + '/' + name,
      hasFacts: fs.existsSync(path.join(factsDir, kind, name))
    };
  }
  var movies = [], shows = [];
  (items || []).forEach(function (item) {
    if (!item || !item.title) return;
    if (item.type === 'movie') movies.push(entry(item, 'movies'));
    if (item.type === 'show') shows.push(entry(item, 'shows'));
  });
  return { movies: movies.sort(byTitle), shows: shows.sort(byTitle) };
}

function report(summary) {
  function count(list) {
    return list.length + ' (' + list.filter(function (x) { return x.hasFacts; }).length + ' with facts)';
  }
  function missing(list) {
    return list.filter(function (x) { return !x.hasFacts; }).map(function (x) {
      return '  ' + x.title + (x.year ? ' (' + x.year + ')' : '') + '    ' + x.file;
    });
  }
  var lines = ['Movies: ' + count(summary.movies), 'Shows: ' + count(summary.shows)];
  var m = missing(summary.movies), s = missing(summary.shows);
  if (m.length) lines = lines.concat(['', 'Movies with no fact file:'], m);
  if (s.length) lines = lines.concat(['', 'Shows with no fact file:'], s);
  if (!m.length && !s.length) lines.push('', 'Every title has a fact file.');
  return lines.join('\n');
}

function main() {
  var loadConfig = require('../lib/config').loadConfig;
  var createPlexClient = require('../lib/plex-client').createPlexClient;
  var parser = require('../lib/plex-parser');
  var config;
  try {
    config = loadConfig(path.join(ROOT, 'config.json'), process.env);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  var plex = createPlexClient({ plexUrl: config.plexUrl, plexToken: config.plexToken, timeoutMs: 60000 });
  plex.getJson('/library/sections').then(function (json) {
    var dirs = (json && json.MediaContainer && json.MediaContainer.Directory) || [];
    var wanted = dirs.filter(function (d) { return d && (d.type === 'movie' || d.type === 'show'); });
    return Promise.all(wanted.map(function (d) {
      return plex.getJson('/library/sections/' + encodeURIComponent(d.key) + '/all').then(parser.parseLibraryItems);
    }));
  }).then(function (lists) {
    var items = [].concat.apply([], lists);
    var summary = summarize(items, path.join(ROOT, 'facts'));
    fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'data', 'library.json'), JSON.stringify({
      movies: summary.movies,
      shows: summary.shows,
      details: items
    }, null, 2));
    console.log(report(summary));
    console.log('\nFull list saved to data/library.json');
  }).catch(function (e) {
    console.error('Could not list the library: ' + e.message);
    process.exit(1);
  });
}

module.exports = { summarize: summarize, report: report };

if (require.main === module) main();
