import * as sensors from './sensors.js';
import * as audio from './audio.js';
import * as recorder from './recorder.js';
import { valueToNote, valueToChordIndex, CHORD_PROGRESSION } from './mapping.js';

const enableBtn = document.getElementById('enable-btn');
const statusEl = document.getElementById('status');
const noteEl = document.getElementById('current-note');
const chordEl = document.getElementById('current-chord');
const xBarEl = document.getElementById('x-bar');
const yBarEl = document.getElementById('y-bar');
const recordBtn = document.getElementById('record-btn');
const timerEl = document.getElementById('timer');
const downloadLink = document.getElementById('download-link');

let recording = false;
let recordStartTime = 0;
let countdownInterval = null;

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
    await Tone.start();
    audio.init();
    audio.start(sensors);

    statusEl.textContent = sensors.isSupported()
      ? 'Playing. Tilt your phone to change the music.'
      : 'No motion sensor detected - playing a fixed neutral note.';

    recordBtn.disabled = !recorder.isSupported();
    if (!recorder.isSupported()) {
      recordBtn.title = 'Recording is not supported in this browser.';
    }

    setInterval(updateReadout, 100);
  } catch (err) {
    statusEl.textContent = 'Could not start audio. Tap Enable to try again.';
    enableBtn.disabled = false;
  }
});

function updateReadout() {
  const note = valueToNote(sensors.getMelodyValue());
  const chord = CHORD_PROGRESSION[valueToChordIndex(sensors.getChordValue())];
  const raw = sensors.getRawValues();
  noteEl.textContent = note;
  chordEl.textContent = chord.name;
  xBarEl.textContent = raw.x.toFixed(2);
  yBarEl.textContent = raw.y.toFixed(2);
}

recordBtn.addEventListener('click', () => {
  if (recording) {
    recorder.stop();
    return;
  }

  const stream = audio.getRecordingStream();
  recordStartTime = Date.now();
  recording = true;
  recordBtn.textContent = 'Stop';
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
