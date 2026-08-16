import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCEL_MIN,
  ACCEL_MAX,
  MELODY_SCALE,
  CHORD_PROGRESSION,
  clamp,
  valueToIndex,
  valueToNote,
  valueToChordIndex,
} from '../js/mapping.js';

test('clamp keeps values within range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
});

test('valueToIndex maps the minimum to index 0', () => {
  assert.equal(valueToIndex(ACCEL_MIN, ACCEL_MIN, ACCEL_MAX, MELODY_SCALE.length), 0);
});

test('valueToIndex maps the maximum to the last index', () => {
  assert.equal(
    valueToIndex(ACCEL_MAX, ACCEL_MIN, ACCEL_MAX, MELODY_SCALE.length),
    MELODY_SCALE.length - 1
  );
});

test('valueToIndex clamps out-of-range input', () => {
  assert.equal(valueToIndex(999, ACCEL_MIN, ACCEL_MAX, MELODY_SCALE.length), MELODY_SCALE.length - 1);
  assert.equal(valueToIndex(-999, ACCEL_MIN, ACCEL_MAX, MELODY_SCALE.length), 0);
});

test('valueToNote returns the first scale note at minimum acceleration', () => {
  assert.equal(valueToNote(ACCEL_MIN), MELODY_SCALE[0]);
});

test('valueToNote returns the last scale note at maximum acceleration', () => {
  assert.equal(valueToNote(ACCEL_MAX), MELODY_SCALE[MELODY_SCALE.length - 1]);
});

test('valueToNote is deterministic for the same input', () => {
  assert.equal(valueToNote(3.2), valueToNote(3.2));
});

test('valueToChordIndex returns the first chord at minimum acceleration', () => {
  assert.equal(valueToChordIndex(ACCEL_MIN), 0);
});

test('valueToChordIndex returns the last chord at maximum acceleration', () => {
  assert.equal(valueToChordIndex(ACCEL_MAX), CHORD_PROGRESSION.length - 1);
});
