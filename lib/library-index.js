'use strict';
// Answers "what else in my library has this director or actor?"

var MAX_TITLES = 3;

function key(name) {
  return String(name || '').trim().toLowerCase();
}

function buildLibraryIndex(items) {
  var byDirector = {};
  var byActor = {};

  function add(map, name, title) {
    var k = key(name);
    if (!k) return;
    if (!Object.prototype.hasOwnProperty.call(map, k)) map[k] = [];
    if (map[k].indexOf(title) === -1) map[k].push(title);
  }

  (Array.isArray(items) ? items : []).forEach(function (item) {
    if (!item || !item.title) return;
    (item.directors || []).forEach(function (d) { add(byDirector, d, item.title); });
    (item.cast || []).forEach(function (a) { add(byActor, a, item.title); });
  });

  function lookup(map, name, excludeTitle) {
    var k = key(name);
    var list = Object.prototype.hasOwnProperty.call(map, k) ? map[k] : [];
    var skip = key(excludeTitle);
    return list.filter(function (t) { return key(t) !== skip; }).sort().slice(0, MAX_TITLES);
  }

  return {
    otherByDirector: function (name, excludeTitle) { return lookup(byDirector, name, excludeTitle); },
    otherByActor: function (name, excludeTitle) { return lookup(byActor, name, excludeTitle); }
  };
}

module.exports = { buildLibraryIndex: buildLibraryIndex };
