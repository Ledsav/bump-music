import * as sensors from './sensors.js';
import * as audio from './audio.js';
import * as recorder from './recorder.js';
import * as geolocation from './geolocation.js';
import * as visualizer from './visualizer.js';
import { valueToNote, valueToChordIndex, CHORD_PROGRESSION } from './mapping.js';
import { VARIANTS, speedToVariantKey, bumpinessToVariantKey } from './variants.js';

const enableBtn = document.getElementById('enable-btn');
const stopBtn = document.getElementById('stop-btn');
const statusEl = document.getElementById('status');
const noteEl = document.getElementById('current-note');
const chordEl = document.getElementById('current-chord');
const variantEl = document.getElementById('variant-badge');
const canvasEl = document.getElementById('waveform');
const recordBtn = document.getElementById('record-btn');
const timerEl = document.getElementById('timer');
const downloadLink = document.getElementById('download-link');

const GEOLOCATION_TIMEOUT_MS = 3000;
const SAMPLE_WINDOW_MS = 5000;

let recording = false;
let recordStartTime = 0;
let countdownInterval = null;
let readoutInterval = null;

enableBtn.addEventListener('click', async () => {
  enableBtn.disabled = true;

  try {
    const granted = await sensors.requestPermission();
    if (!granted && sensors.isSupported()) {
      statusEl.textContent = 'Motion permission denied. Tap Enable again to retry.';
      enableBtn.disabled = false;
      return;
    }

    sensors.start();

    const sampleStart = Date.now();
    statusEl.textContent = 'Sampling road...';

    const speed = await geolocation.getSpeedSample(GEOLOCATION_TIMEOUT_MS);

    let variantKey;
    if (typeof speed === 'number') {
      variantKey = speedToVariantKey(speed);
    } else {
      const elapsed = Date.now() - sampleStart;
      const remaining = Math.max(0, SAMPLE_WINDOW_MS - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      variantKey = bumpinessToVariantKey(sensors.getBumpiness());
    }

    const variant = VARIANTS[variantKey];
    variantEl.textContent = variant.name;

    await Tone.start();
    audio.init(variant);
    audio.start(sensors);
    visualizer.init(canvasEl, audio.getAnalyser());
    visualizer.start();

    statusEl.textContent = sensors.isSupported()
      ? 'Playing. Tilt your phone to change the music.'
      : 'No motion sensor detected - playing a fixed neutral note.';

    enableBtn.style.display = 'none';
    stopBtn.style.display = '';
    recordBtn.disabled = !recorder.isSupported();
    if (!recorder.isSupported()) {
      recordBtn.title = 'Recording is not supported in this browser.';
    }

    readoutInterval = setInterval(updateReadout, 100);
  } catch (err) {
    statusEl.textContent = 'Could not start audio. Tap Enable to try again.';
    enableBtn.disabled = false;
  }
});

stopBtn.addEventListener('click', () => {
  if (recording) {
    recorder.stop();
  }
  audio.stop();
  visualizer.stop();
  if (readoutInterval) {
    clearInterval(readoutInterval);
    readoutInterval = null;
  }

  stopBtn.style.display = 'none';
  enableBtn.style.display = '';
  enableBtn.disabled = false;
  recordBtn.disabled = true;
  statusEl.textContent = 'Tap the button to start.';
  noteEl.textContent = '-';
  chordEl.textContent = '-';
  variantEl.textContent = '-';
});

function updateReadout() {
  const note = valueToNote(sensors.getMelodyValue());
  const chord = CHORD_PROGRESSION[valueToChordIndex(sensors.getChordValue())];
  noteEl.textContent = note;
  chordEl.textContent = chord.name;
}

recordBtn.addEventListener('click', () => {
  if (recording) {
    recorder.stop();
    return;
  }

  const stream = audio.getRecordingStream();
  recordStartTime = Date.now();
  recording = true;
  recordBtn.textContent = 'Stop Recording';
  downloadLink.style.display = 'none';

  countdownInterval = setInterval(updateCountdown, 200);

  recorder.start(stream, (url) => {
    recording = false;
    recordBtn.textContent = 'Record';
    clearInterval(countdownInterval);
    timerEl.textContent = '';
    downloadLink.href = url;
    downloadLink.download = `bump-music-${Date.now()}.webm`;
    downloadLink.style.display = 'inline';
  });
});

function updateCountdown() {
  const elapsed = Date.now() - recordStartTime;
  const remaining = Math.max(0, recorder.getMaxDurationMs() - elapsed);
  const seconds = Math.ceil(remaining / 1000);
  timerEl.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
