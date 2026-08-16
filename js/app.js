import * as audio from './audio.js';
import * as geolocation from './geolocation.js';
import { CHORD_PROGRESSION, valueToChordIndex, valueToNote } from './mapping.js';
import * as recorder from './recorder.js';
import * as sensors from './sensors.js';
import { VARIANTS, bumpinessToVariantKey, speedToVariantKey } from './variants.js';
import * as visualizer from './visualizer.js';

const mainBtn = document.getElementById('main-btn');
const iconPlay = mainBtn.querySelector('.icon-play');
const iconPause = mainBtn.querySelector('.icon-pause');
const statusEl = document.getElementById('status');
const noteEl = document.getElementById('current-note');
const chordEl = document.getElementById('current-chord');
const variantEl = document.getElementById('variant-badge');
const canvasEl = document.getElementById('waveform');
const recordBtn = document.getElementById('record-btn');
const downloadLink = document.getElementById('download-link');
const scrubFill = document.getElementById('scrub-fill');
const scrubLeft = document.getElementById('scrub-left');
const scrubRight = document.getElementById('scrub-right');

const GEOLOCATION_TIMEOUT_MS = 3000;
const SAMPLE_WINDOW_MS = 5000;

let playing = false;
let recording = false;
let recordStartTime = 0;
let countdownInterval = null;
let readoutInterval = null;

mainBtn.addEventListener('click', () => {
  if (playing) {
    stopPlayback();
  } else {
    startPlayback();
  }
});

async function startPlayback() {
  mainBtn.disabled = true;

  try {
    const granted = await sensors.requestPermission();
    if (!granted && sensors.isSupported()) {
      statusEl.textContent = 'Motion permission denied. Tap play again to retry.';
      mainBtn.disabled = false;
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
      ? 'Tilt your phone to change the music.'
      : 'No motion sensor detected - playing a fixed neutral note.';

    playing = true;
    iconPlay.classList.add('is-hidden');
    iconPause.classList.remove('is-hidden');
    mainBtn.setAttribute('aria-label', 'Stop');
    mainBtn.disabled = false;

    recordBtn.disabled = !recorder.isSupported();
    if (!recorder.isSupported()) {
      recordBtn.title = 'Recording is not supported in this browser.';
    }

    setLiveScrub();
    readoutInterval = setInterval(updateReadout, 100);
  } catch (err) {
    statusEl.textContent = 'Could not start audio. Tap play to try again.';
    mainBtn.disabled = false;
  }
}

function stopPlayback() {
  if (recording) {
    recorder.stop();
  }
  audio.stop();
  visualizer.stop();
  if (readoutInterval) {
    clearInterval(readoutInterval);
    readoutInterval = null;
  }

  playing = false;
  iconPlay.classList.remove('is-hidden');
  iconPause.classList.add('is-hidden');
  mainBtn.setAttribute('aria-label', 'Play');
  recordBtn.disabled = true;
  statusEl.textContent = 'Tap play to start.';
  noteEl.textContent = '-';
  chordEl.textContent = '-';
  variantEl.textContent = '-';
  resetScrub();
}

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
  recordBtn.classList.add('is-recording');
  downloadLink.classList.add('is-disabled');

  countdownInterval = setInterval(updateCountdown, 200);
  updateCountdown();

  recorder.start(stream, (url) => {
    recording = false;
    recordBtn.classList.remove('is-recording');
    clearInterval(countdownInterval);
    countdownInterval = null;
    if (playing) {
      setLiveScrub();
    } else {
      resetScrub();
    }
    downloadLink.href = url;
    downloadLink.download = `bump-music-${Date.now()}.webm`;
    downloadLink.classList.remove('is-disabled');
  });
});

function updateCountdown() {
  const elapsed = Date.now() - recordStartTime;
  const max = recorder.getMaxDurationMs();
  const remaining = Math.max(0, max - elapsed);

  scrubFill.classList.remove('is-live');
  scrubFill.style.width = `${Math.min(100, (elapsed / max) * 100)}%`;
  scrubLeft.textContent = formatClock(elapsed);
  scrubRight.textContent = `-${formatClock(remaining)}`;
}

function setLiveScrub() {
  scrubFill.style.width = '';
  scrubFill.classList.add('is-live');
  scrubLeft.textContent = 'Live';
  scrubRight.textContent = '';
}

function resetScrub() {
  scrubFill.classList.remove('is-live');
  scrubFill.style.width = '0%';
  scrubLeft.textContent = '';
  scrubRight.textContent = '';
}

function formatClock(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

