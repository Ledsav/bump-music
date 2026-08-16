export const VARIANTS = {
  chill: {
    name: 'Chill',
    baseTempo: 84,
    pad: { attack: 1.2, release: 2.5, volume: -14 },
  },
  drive: {
    name: 'Drive',
    baseTempo: 96,
    pad: { attack: 0.8, release: 1.5, volume: -12 },
  },
  rough: {
    name: 'Rough',
    baseTempo: 108,
    pad: { attack: 0.3, release: 0.8, volume: -10 },
  },
};

const TIER_TO_VARIANT_KEY = { low: 'chill', medium: 'drive', high: 'rough' };

export function bumpinessToTier(bumpiness) {
  if (bumpiness < 1.5) return 'low';
  if (bumpiness <= 4) return 'medium';
  return 'high';
}

export function bumpinessToVariantKey(bumpiness) {
  return TIER_TO_VARIANT_KEY[bumpinessToTier(bumpiness)];
}

export function speedToVariantKey(speedMetersPerSecond) {
  if (speedMetersPerSecond < 2) return 'chill';
  if (speedMetersPerSecond <= 15) return 'drive';
  return 'rough';
}
