export function isSupported() {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

export function getSpeedSample(timeoutMs) {
  return new Promise((resolve) => {
    if (!isSupported()) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const speed = position.coords.speed;
        resolve(typeof speed === 'number' ? speed : null);
      },
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 0 }
    );
  });
}
