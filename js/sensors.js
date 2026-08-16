const FAST_ALPHA = 0.3;
const SLOW_ALPHA = 0.02;

let fastX = 0;
let slowY = 0;
let rawX = 0;
let rawY = 0;
let rawZ = 0;
let listening = false;

export function smooth(previous, raw, alpha) {
  return previous + alpha * (raw - previous);
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

export function getRawValues() {
  return { x: rawX, y: rawY, z: rawZ };
}
