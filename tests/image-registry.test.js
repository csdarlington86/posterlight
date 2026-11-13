'use strict';
var test = require('node:test');
var assert = require('node:assert');
var createImageRegistry = require('../lib/image-registry').createImageRegistry;

test('ids are stable, opaque, and map back to the source', function () {
  var r = createImageRegistry();
  var id = r.idFor('/library/metadata/1/thumb/2');
  assert.match(id, /^[0-9a-f]{16}$/);
  assert.strictEqual(r.idFor('/library/metadata/1/thumb/2'), id);
  assert.strictEqual(r.sourceFor(id), '/library/metadata/1/thumb/2');
  assert.notStrictEqual(r.idFor('/library/metadata/9/thumb/2'), id);
});

test('unknown ids and empty sources give null', function () {
  var r = createImageRegistry();
  assert.strictEqual(r.sourceFor('zzz'), null);
  assert.strictEqual(r.sourceFor('toString'), null);
  assert.strictEqual(r.idFor(''), null);
  assert.strictEqual(r.idFor(null), null);
});

test('clampSize keeps sizes sane', function () {
  var r = createImageRegistry();
  assert.strictEqual(r.clampSize('abc'), 400);
  assert.strictEqual(r.clampSize(undefined), 400);
  assert.strictEqual(r.clampSize(999999), 1600);
  assert.strictEqual(r.clampSize(10), 100);
  assert.strictEqual(r.clampSize(350), 400);
  assert.strictEqual(r.clampSize('800'), 800);
  assert.strictEqual(r.clampSize(-5), 100);
});
