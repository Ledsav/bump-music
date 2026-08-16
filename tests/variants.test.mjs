import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VARIANTS,
  bumpinessToTier,
  bumpinessToVariantKey,
  speedToVariantKey,
} from '../js/variants.js';

test('bumpinessToTier classifies low bumpiness', () => {
  assert.equal(bumpinessToTier(0), 'low');
  assert.equal(bumpinessToTier(1.49), 'low');
});

test('bumpinessToTier classifies medium bumpiness', () => {
  assert.equal(bumpinessToTier(1.5), 'medium');
  assert.equal(bumpinessToTier(4), 'medium');
});

test('bumpinessToTier classifies high bumpiness', () => {
  assert.equal(bumpinessToTier(4.01), 'high');
  assert.equal(bumpinessToTier(100), 'high');
});

test('speedToVariantKey classifies chill at walking/stopped speed', () => {
  assert.equal(speedToVariantKey(0), 'chill');
  assert.equal(speedToVariantKey(1.99), 'chill');
});

test('speedToVariantKey classifies drive at city speed', () => {
  assert.equal(speedToVariantKey(2), 'drive');
  assert.equal(speedToVariantKey(15), 'drive');
});

test('speedToVariantKey classifies rough at highway speed', () => {
  assert.equal(speedToVariantKey(15.01), 'rough');
  assert.equal(speedToVariantKey(40), 'rough');
});

test('bumpinessToVariantKey matches the same tier boundaries as bumpinessToTier', () => {
  assert.equal(bumpinessToVariantKey(0), 'chill');
  assert.equal(bumpinessToVariantKey(2), 'drive');
  assert.equal(bumpinessToVariantKey(10), 'rough');
});

test('VARIANTS has exactly chill, drive, rough with the required fields', () => {
  for (const key of ['chill', 'drive', 'rough']) {
    assert.ok(VARIANTS[key], `missing variant ${key}`);
    assert.equal(typeof VARIANTS[key].name, 'string');
    assert.equal(typeof VARIANTS[key].baseTempo, 'number');
    assert.equal(typeof VARIANTS[key].pad.attack, 'number');
    assert.equal(typeof VARIANTS[key].pad.release, 'number');
    assert.equal(typeof VARIANTS[key].pad.volume, 'number');
  }
});

test('VARIANTS values match the spec exactly', () => {
  assert.deepEqual(VARIANTS.chill, { name: 'Chill', baseTempo: 84, pad: { attack: 1.2, release: 2.5, volume: -14 } });
  assert.deepEqual(VARIANTS.drive, { name: 'Drive', baseTempo: 96, pad: { attack: 0.8, release: 1.5, volume: -12 } });
  assert.deepEqual(VARIANTS.rough, { name: 'Rough', baseTempo: 108, pad: { attack: 0.3, release: 0.8, volume: -10 } });
});
