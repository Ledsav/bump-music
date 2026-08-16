export const ACCEL_MIN = -9.8;
export const ACCEL_MAX = 9.8;

export const MELODY_SCALE = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'];

export const CHORD_PROGRESSION = [
  { name: 'C', root: 'C2', notes: ['C4', 'E4', 'G4'] },
  { name: 'G', root: 'G1', notes: ['G3', 'B3', 'D4'] },
  { name: 'Am', root: 'A1', notes: ['A3', 'C4', 'E4'] },
  { name: 'F', root: 'F1', notes: ['F3', 'A3', 'C4'] },
];

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function valueToIndex(value, min, max, steps) {
  const clamped = clamp(value, min, max);
  const ratio = (clamped - min) / (max - min);
  const index = Math.round(ratio * (steps - 1));
  return clamp(index, 0, steps - 1);
}

export function valueToNote(value) {
  const index = valueToIndex(value, ACCEL_MIN, ACCEL_MAX, MELODY_SCALE.length);
  return MELODY_SCALE[index];
}

export function valueToChordIndex(value) {
  return valueToIndex(value, ACCEL_MIN, ACCEL_MAX, CHORD_PROGRESSION.length);
}
