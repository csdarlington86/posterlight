'use strict';
var test = require('node:test');
var assert = require('node:assert');
var slugify = require('../lib/slug').slugify;

test('slugify handles odd titles', function () {
  assert.strictEqual(slugify('WALL·E'), 'wall-e');
  assert.strictEqual(slugify('Amélie'), 'amelie');
  assert.strictEqual(slugify('Se7en'), 'se7en');
  assert.strictEqual(slugify('M*A*S*H'), 'm-a-s-h');
  assert.strictEqual(slugify('Tom & Jerry'), 'tom-and-jerry');
  assert.strictEqual(slugify('  The Thing! '), 'the-thing');
  assert.strictEqual(slugify("Ocean's Eleven"), 'oceans-eleven');
  assert.strictEqual(slugify(null), '');
});
