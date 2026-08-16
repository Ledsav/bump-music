import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smooth } from '../js/sensors.js';

test('smooth returns previous value unchanged when alpha is 0', () => {
  assert.equal(smooth(1, 5, 0), 1);
});

test('smooth returns the raw value immediately when alpha is 1', () => {
  assert.equal(smooth(1, 5, 1), 5);
});

test('smooth moves partway from previous toward raw', () => {
  assert.equal(smooth(0, 10, 0.5), 5);
});

test('smooth is deterministic for the same inputs', () => {
  assert.equal(smooth(2, 8, 0.3), smooth(2, 8, 0.3));
});
