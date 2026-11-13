'use strict';
// Gives every Plex image an opaque id. Devices ask for /img/<id>, never for a Plex path,
// so a device cannot make the helper fetch an address of its own choosing.
var crypto = require('crypto');

var MAX_ENTRIES = 5000;
var DEFAULT_SIZE = 400;
var MIN_SIZE = 64;
var MAX_SIZE = 1600;

function createImageRegistry() {
  var sources = new Map();

  function idFor(sourcePath) {
    if (!sourcePath || typeof sourcePath !== 'string') return null;
    var id = crypto.createHash('sha1').update(sourcePath).digest('hex').slice(0, 16);
    if (!sources.has(id)) {
      if (sources.size >= MAX_ENTRIES) sources.delete(sources.keys().next().value);
      sources.set(id, sourcePath);
    }
    return id;
  }

  function sourceFor(id) {
    return sources.has(id) ? sources.get(id) : null;
  }

  function clampSize(value) {
    var n = parseInt(value, 10);
    if (!isFinite(n)) n = DEFAULT_SIZE;
    n = Math.max(MIN_SIZE, Math.min(MAX_SIZE, n));
    return Math.ceil(n / 100) * 100;
  }

  return { idFor: idFor, sourceFor: sourceFor, clampSize: clampSize };
}

module.exports = { createImageRegistry: createImageRegistry };
