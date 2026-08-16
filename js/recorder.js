const MAX_DURATION_MS = 2 * 60 * 1000;
const MIME_TYPE = 'audio/webm;codecs=opus';

let mediaRecorder = null;
let chunks = [];
let autoStopTimer = null;
let lastObjectUrl = null;

export function isSupported() {
  return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(MIME_TYPE);
}

export function start(stream, onStop) {
  chunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType: MIME_TYPE });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  mediaRecorder.onstop = () => {
    clearTimeout(autoStopTimer);
    if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
    const blob = new Blob(chunks, { type: MIME_TYPE });
    lastObjectUrl = URL.createObjectURL(blob);
    onStop(lastObjectUrl);
  };

  mediaRecorder.start();
  autoStopTimer = setTimeout(() => stop(), MAX_DURATION_MS);
}

export function stop() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

export function getMaxDurationMs() {
  return MAX_DURATION_MS;
}
