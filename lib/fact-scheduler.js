'use strict';
// Decides where in a title each fact appears. Pure math, no clock.
// Slots follow the playback position, so a pause or a seek keeps every device in step.

function valid(durationMs, count) {
  return durationMs > 0 && count > 0;
}

function slotOffsets(durationMs, count) {
  if (!valid(durationMs, count)) return [];
  var out = [];
  for (var i = 0; i < count; i++) out.push(Math.round(durationMs * (i + 1) / (count + 1)));
  return out;
}

function activeSlot(durationMs, count, offsetMs, showMs) {
  if (!valid(durationMs, count)) return -1;
  var spacing = durationMs / (count + 1);
  var windowMs = Math.min(showMs, 0.8 * spacing);
  var slots = slotOffsets(durationMs, count);
  for (var i = 0; i < slots.length; i++) {
    if (offsetMs >= slots[i] && offsetMs < slots[i] + windowMs) return i;
  }
  return -1;
}

function fitCount(durationMs, wanted, available) {
  if (!(durationMs > 0)) return 0;
  return Math.max(0, Math.min(wanted, available));
}

module.exports = { slotOffsets: slotOffsets, activeSlot: activeSlot, fitCount: fitCount };
