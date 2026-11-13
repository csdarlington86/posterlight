'use strict';
// Checks every fact file that ships in facts/. Run after adding or editing a file.
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var slugify = require('../lib/slug').slugify;

var ROOT = path.join(__dirname, '..', 'facts');
var MAX_CHARS = 200;

function files(kind) {
  var dir = path.join(ROOT, kind);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f); }).map(function (f) {
    return { kind: kind, name: f, full: path.join(dir, f) };
  });
}

files('movies').concat(files('shows')).forEach(function (file) {
  test('facts/' + file.kind + '/' + file.name + ' is valid', function () {
    var json = JSON.parse(fs.readFileSync(file.full, 'utf8'));
    assert.ok(typeof json.title === 'string' && json.title.trim() !== '', 'title is missing');
    assert.ok(Array.isArray(json.facts) && json.facts.length > 0, 'facts is missing or empty');
    var seen = {};
    json.facts.forEach(function (fact, i) {
      assert.ok(typeof fact === 'string' && fact.trim() !== '', 'fact ' + i + ' is empty');
      assert.ok(fact.length <= MAX_CHARS, 'fact ' + i + ' is ' + fact.length + ' characters (limit ' + MAX_CHARS + ')');
      assert.ok(!seen[fact.toLowerCase()], 'fact ' + i + ' is a duplicate');
      seen[fact.toLowerCase()] = true;
    });
    if (json.ids !== undefined) {
      assert.ok(Array.isArray(json.ids), 'ids must be a list');
      json.ids.forEach(function (id) {
        assert.ok(/^(imdb:\/\/tt\d+|tmdb:\/\/\d+|tvdb:\/\/\d+)$/.test(id), 'id "' + id + '" must look like imdb://tt0078748, tmdb://348 or tvdb://81189');
      });
    }
    var slug = slugify(json.title);
    var expected = file.kind === 'movies' && json.year ? slug + '-' + json.year + '.json' : slug + '.json';
    assert.strictEqual(file.name, expected, 'file name must match the title' + (file.kind === 'movies' ? ' and year' : ''));
  });
});

test('the facts folders exist', function () {
  assert.ok(fs.existsSync(path.join(ROOT, 'movies')));
  assert.ok(fs.existsSync(path.join(ROOT, 'shows')));
});
