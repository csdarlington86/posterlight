'use strict';
var test = require('node:test');
var assert = require('node:assert');
var sched = require('../lib/fact-scheduler');

test('15 movie slots are spread evenly across 2 hours', function () {
  var slots = sched.slotOffsets(7200000, 15);
  assert.strictEqual(slots.length, 15);
  assert.strictEqual(slots[0], 450000);
  assert.strictEqual(slots[14], 6750000);
  for (var i = 1; i < slots.length; i++) assert.strictEqual(slots[i] - slots[i - 1], 450000);
});

test('3 episode slots across 30 minutes', function () {
  assert.deepStrictEqual(sched.slotOffsets(1800000, 3), [450000, 900000, 1350000]);
});

test('a slot is active for 60 seconds from its start', function () {
  assert.strictEqual(sched.activeSlot(7200000, 15, 449999, 60000), -1);
  assert.strictEqual(sched.activeSlot(7200000, 15, 450000, 60000), 0);
  assert.strictEqual(sched.activeSlot(7200000, 15, 509999, 60000), 0);
  assert.strictEqual(sched.activeSlot(7200000, 15, 510000, 60000), -1);
  assert.strictEqual(sched.activeSlot(7200000, 15, 6750000, 60000), 14);
  assert.strictEqual(sched.activeSlot(7200000, 15, 0, 60000), -1);
});

test('a short runtime shrinks the window so facts never overlap', function () {
  // 5 minutes, 15 slots: spacing 18750 ms, window 15000 ms.
  assert.strictEqual(sched.activeSlot(300000, 15, 18750, 60000), 0);
  assert.strictEqual(sched.activeSlot(300000, 15, 18750 + 14999, 60000), 0);
  assert.strictEqual(sched.activeSlot(300000, 15, 18750 + 15000, 60000), -1);
  assert.strictEqual(sched.activeSlot(300000, 15, 37500, 60000), 1);
});

test('unknown runtime or zero count gives no slots', function () {
  assert.deepStrictEqual(sched.slotOffsets(0, 15), []);
  assert.deepStrictEqual(sched.slotOffsets(7200000, 0), []);
  assert.strictEqual(sched.activeSlot(0, 15, 0, 60000), -1);
  assert.strictEqual(sched.activeSlot(7200000, 0, 450000, 60000), -1);
  assert.strictEqual(sched.activeSlot(NaN, 15, 5, 60000), -1);
});

test('fitCount uses what is available, and nothing for an unknown runtime', function () {
  assert.strictEqual(sched.fitCount(7200000, 15, 9), 9);
  assert.strictEqual(sched.fitCount(7200000, 15, 40), 15);
  assert.strictEqual(sched.fitCount(0, 15, 20), 0);
});
