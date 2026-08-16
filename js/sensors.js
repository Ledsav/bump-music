const FAST_ALPHA = 0.3;
const SLOW_ALPHA = 0.02;
const BUMPINESS_ALPHA = 0.15;

let fastX = 0;
let slowY = 0;
let rawX = 0;
let rawY = 0;
let rawZ = 0;
let bumpiness = 0;
let prevRawX = 0;
let prevRawY = 0;
let prevRawZ = 0;
let hasPrevRaw = false;
let listening = false;

export function smooth(previous, raw, alpha) {
  return previous + alpha * (raw - previous);
}

export function jerkMagnitude(dx, dy, dz) {
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function isSupported() {
  return typeof window !== 'undefined' && typeof window.DeviceMotionEvent !== 'undefined';
}

export async function requestPermission() {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    const result = await DeviceMotionEvent.requestPermission();
    return result === 'granted';
  }
  return isSupported();
}

function handleMotion(event) {
  const accel = event.accelerationIncludingGravity;
  if (!accel) return;
  rawX = accel.x ?? 0;
  rawY = accel.y ?? 0;
  rawZ = accel.z ?? 0;
  fastX = smooth(fastX, rawX, FAST_ALPHA);
  slowY = smooth(slowY, rawY, SLOW_ALPHA);

  if (hasPrevRaw) {
    const jerk = jerkMagnitude(rawX - prevRawX, rawY - prevRawY, rawZ - prevRawZ);
    bumpiness = smooth(bumpiness, jerk, BUMPINESS_ALPHA);
  }
  prevRawX = rawX;
  prevRawY = rawY;
  prevRawZ = rawZ;
  hasPrevRaw = true;
}

export function start() {
  if (listening || !isSupported()) return;
  window.addEventListener('devicemotion', handleMotion);
  listening = true;
}

export function getMelodyValue() {
  return fastX;
}

export function getChordValue() {
  return slowY;
}

export function getBumpiness() {
  return bumpiness;
}

export function getRawValues() {
  return { x: rawX, y: rawY, z: rawZ };
}
