# Bump Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, motion-driven generative music web app (melody + chords + beat from phone tilt, 2-minute recording/download) and deploy it to GitHub Pages, per `docs/superpowers/specs/2026-08-16-motion-music-design.md`.

**Architecture:** Plain ES modules, no bundler, no npm install. Tone.js loaded from a CDN `<script>` tag. Five files under `js/` (`mapping.js`, `sensors.js`, `audio.js`, `recorder.js`, `app.js`), each with one responsibility, wired together by `app.js`. Pure logic (`mapping.js`, and `sensors.js`'s `smooth()`) gets real unit tests run via Node's built-in test runner; everything that touches the DOM, Web Audio, or device sensors is verified manually in-browser (Chrome DevTools' Sensors panel emulates tilt on desktop, so no phone is needed until final acceptance).

**Tech Stack:** HTML5, CSS3, vanilla JS (ES modules), Tone.js (via CDN, pinned to major version 14), Web Audio `MediaRecorder`/`MediaStreamAudioDestinationNode`, Node.js built-in test runner (`node --test`) for unit tests only — no other dependencies.

## Global Constraints

- No build step, no bundler, no npm dependencies installed into the project — `index.html` loads Tone.js from a CDN `<script>` tag and local files as ES modules directly.
- No `Math.random()` or any other nondeterministic source anywhere in sensor smoothing, note/chord mapping, or audio scheduling — output must be identical given identical input history and elapsed time.
- Single device only: the phone reads its own sensor and plays its own audio in the same tab. No networking, no backend, no multi-device sync.
- Must work on both Android Chrome and iOS Safari, including iOS's `DeviceMotionEvent.requestPermission()` gesture-gated prompt.
- Recording is capped at a hard maximum of 2 minutes (120000 ms) and downloads as `audio/webm;codecs=opus`.
- Deploys to GitHub Pages via a GitHub Actions workflow triggered on push to `main`, publishing the repo root — `index.html` lives at the repo root.
- Melody scale is C major pentatonic (`C4 D4 E4 G4 A4 C5 D5 E5`); chord progression is fixed I–V–vi–IV in C (`C–G–Am–F`); tempo is fixed at 96 BPM.

---

### Task 1: Static page scaffold

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `js/app.js` (stub only — filled in by Task 6)

**Interfaces:**
- Produces: the final DOM element IDs every later task's JS binds to: `enable-btn`, `status`, `current-note`, `current-chord`, `x-bar`, `y-bar`, `record-btn`, `timer`, `download-link`. No later task modifies `index.html` again.

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bump Music</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main>
    <h1>Bump Music</h1>
    <button id="enable-btn">Enable Motion &amp; Audio</button>
    <p id="status">Tap the button to start.</p>

    <section id="readout">
      <div class="readout-row">
        <span class="label">Note</span>
        <span id="current-note">-</span>
      </div>
      <div class="readout-row">
        <span class="label">Chord</span>
        <span id="current-chord">-</span>
      </div>
      <div class="readout-row">
        <span class="label">X</span>
        <span id="x-bar">0.00</span>
      </div>
      <div class="readout-row">
        <span class="label">Y</span>
        <span id="y-bar">0.00</span>
      </div>
    </section>

    <section id="controls">
      <button id="record-btn" disabled>Record</button>
      <span id="timer"></span>
      <a id="download-link" style="display:none" download>Download recording</a>
    </section>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/tone@14/build/Tone.js"></script>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `style.css`**

```css
:root {
  color-scheme: dark;
  font-family: system-ui, -apple-system, sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: #12141a;
  color: #f5f5f7;
}

main {
  width: 100%;
  max-width: 480px;
  padding: 24px 20px 48px;
  box-sizing: border-box;
  text-align: center;
}

h1 {
  font-size: 1.5rem;
  margin-bottom: 24px;
}

button {
  font-size: 1.1rem;
  padding: 14px 24px;
  border-radius: 999px;
  border: none;
  background: #5b8cff;
  color: white;
  cursor: pointer;
}

button:disabled {
  background: #3a3d47;
  color: #8a8d99;
  cursor: not-allowed;
}

#status {
  margin-top: 16px;
  min-height: 1.5em;
  color: #b5b8c5;
}

#readout {
  margin-top: 32px;
  display: grid;
  gap: 12px;
}

.readout-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 16px;
  background: #1c1f28;
  border-radius: 12px;
  font-variant-numeric: tabular-nums;
}

.label {
  color: #8a8d99;
}

#controls {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

#timer {
  font-variant-numeric: tabular-nums;
  color: #b5b8c5;
}

#download-link {
  color: #5b8cff;
}
```

- [ ] **Step 3: Create the `js/app.js` stub**

```js
console.log('Bump Music loaded');
```

- [ ] **Step 4: Serve locally and verify the page renders**

Run: `npx --yes serve . -l 5000`
Expected: terminal prints a local address such as `http://localhost:5000`.

Open that address in Chrome. Expected: the "Bump Music" heading, an "Enable Motion & Audio" button, the four readout rows (Note/Chord/X/Y), a disabled "Record" button, and no errors in the DevTools console (the "Bump Music loaded" log line should appear).

Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 5: Commit**

```bash
git add index.html style.css js/app.js
git commit -m "Add static page scaffold for Bump Music"
```

---

### Task 2: `mapping.js` — scale/chord tables and quantization (TDD)

**Files:**
- Create: `js/mapping.js`
- Test: `tests/mapping.test.mjs`

**Interfaces:**
- Produces:
  - `ACCEL_MIN: number` (`-9.8`)
  - `ACCEL_MAX: number` (`9.8`)
  - `MELODY_SCALE: string[]` (`['C4','D4','E4','G4','A4','C5','D5','E5']`)
  - `CHORD_PROGRESSION: Array<{ name: string, root: string, notes: string[] }>` (4 entries: C, G, Am, F)
  - `clamp(value: number, min: number, max: number): number`
  - `valueToIndex(value: number, min: number, max: number, steps: number): number`
  - `valueToNote(value: number): string`
  - `valueToChordIndex(value: number): number`
- Consumes: nothing (pure module, no imports).

- [ ] **Step 1: Write the failing tests**

Create `tests/mapping.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCEL_MIN,
  ACCEL_MAX,
  MELODY_SCALE,
  CHORD_PROGRESSION,
  clamp,
  valueToIndex,
  valueToNote,
  valueToChordIndex,
} from '../js/mapping.js';

test('clamp keeps values within range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
});

test('valueToIndex maps the minimum to index 0', () => {
  assert.equal(valueToIndex(ACCEL_MIN, ACCEL_MIN, ACCEL_MAX, MELODY_SCALE.length), 0);
});

test('valueToIndex maps the maximum to the last index', () => {
  assert.equal(
    valueToIndex(ACCEL_MAX, ACCEL_MIN, ACCEL_MAX, MELODY_SCALE.length),
    MELODY_SCALE.length - 1
  );
});

test('valueToIndex clamps out-of-range input', () => {
  assert.equal(valueToIndex(999, ACCEL_MIN, ACCEL_MAX, MELODY_SCALE.length), MELODY_SCALE.length - 1);
  assert.equal(valueToIndex(-999, ACCEL_MIN, ACCEL_MAX, MELODY_SCALE.length), 0);
});

test('valueToNote returns the first scale note at minimum acceleration', () => {
  assert.equal(valueToNote(ACCEL_MIN), MELODY_SCALE[0]);
});

test('valueToNote returns the last scale note at maximum acceleration', () => {
  assert.equal(valueToNote(ACCEL_MAX), MELODY_SCALE[MELODY_SCALE.length - 1]);
});

test('valueToNote is deterministic for the same input', () => {
  assert.equal(valueToNote(3.2), valueToNote(3.2));
});

test('valueToChordIndex returns the first chord at minimum acceleration', () => {
  assert.equal(valueToChordIndex(ACCEL_MIN), 0);
});

test('valueToChordIndex returns the last chord at maximum acceleration', () => {
  assert.equal(valueToChordIndex(ACCEL_MAX), CHORD_PROGRESSION.length - 1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/mapping.test.mjs`
Expected: FAIL — Node reports an error resolving `../js/mapping.js` (module does not exist yet).

- [ ] **Step 3: Write `js/mapping.js`**

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/mapping.test.mjs`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add js/mapping.js tests/mapping.test.mjs
git commit -m "Add deterministic scale/chord mapping with unit tests"
```

---

### Task 3: `sensors.js` — motion permission, listener, and smoothing (TDD for the pure part)

**Files:**
- Create: `js/sensors.js`
- Test: `tests/sensors.test.mjs`

**Interfaces:**
- Produces:
  - `smooth(previous: number, raw: number, alpha: number): number`
  - `isSupported(): boolean`
  - `requestPermission(): Promise<boolean>`
  - `start(): void`
  - `getMelodyValue(): number`
  - `getChordValue(): number`
  - `getRawValues(): { x: number, y: number, z: number }`
- Consumes: nothing custom (browser globals `window`, `DeviceMotionEvent` only).

- [ ] **Step 1: Write the failing test for the pure smoothing function**

Create `tests/sensors.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smooth } from '../js/sensors.js';

test('smooth returns previous value unchanged when alpha is 0', () => {
  assert.equal(smooth(1, 5, 0), 1);
});

test('smooth returns the raw value immediately when alpha is 1', () => {
  assert.equal(smooth(1, 5, 1), 5);
});

test('smooth moves partway from previous toward raw', () => {
  assert.equal(smooth(0, 10, 0.5), 5);
});

test('smooth is deterministic for the same inputs', () => {
  assert.equal(smooth(2, 8, 0.3), smooth(2, 8, 0.3));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/sensors.test.mjs`
Expected: FAIL — Node reports an error resolving `../js/sensors.js` (module does not exist yet).

- [ ] **Step 3: Write `js/sensors.js`**

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/sensors.test.mjs`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Manually verify motion listening in a browser**

Run: `npx --yes serve . -l 5000`, open `http://localhost:5000` in Chrome.

Open DevTools (F12) → Console, and run:

```js
const sensors = await import('./js/sensors.js');
sensors.start();
```

Open DevTools → the `⋮` overflow menu → More tools → Sensors, and under "Orientation" drag the 3D phone model or pick a preset (e.g. "Portrait upside down") to simulate tilt.

In the Console, run `sensors.getRawValues()` a few times while changing the orientation. Expected: the `x`/`y`/`z` values change as the simulated orientation changes. Then run `sensors.getMelodyValue()` and `sensors.getChordValue()` repeatedly — expected: `getMelodyValue()` tracks changes quickly, `getChordValue()` drifts toward the new value slowly (it's the slow EMA).

Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 6: Commit**

```bash
git add js/sensors.js tests/sensors.test.mjs
git commit -m "Add motion sensor listener with exponential smoothing"
```

---

### Task 4: `audio.js` — Tone.js synths, deterministic clock, recording tap

**Files:**
- Create: `js/audio.js`

**Interfaces:**
- Consumes: `CHORD_PROGRESSION`, `valueToNote`, `valueToChordIndex` from `js/mapping.js`; global `Tone` (loaded via CDN `<script>` in `index.html`); an object with `getMelodyValue(): number` and `getChordValue(): number` (satisfied by `js/sensors.js`).
- Produces:
  - `init(): void`
  - `start(sensors: { getMelodyValue(): number, getChordValue(): number }): void`
  - `stop(): void`
  - `getRecordingStream(): MediaStream`

- [ ] **Step 1: Write `js/audio.js`**

```js
import { CHORD_PROGRESSION, valueToNote, valueToChordIndex } from './mapping.js';

let melodySynth;
let bassSynth;
let padSynth;
let kick;
let hihat;
let melodyLoop;
let chordLoop;
let recordingDestination;

export function init() {
  melodySynth = new Tone.Synth({ oscillator: { type: 'triangle' } }).toDestination();
  bassSynth = new Tone.MonoSynth({ oscillator: { type: 'sine' } }).toDestination();
  padSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.8, decay: 0.2, sustain: 0.6, release: 1.5 },
    volume: -12,
  }).toDestination();
  kick = new Tone.MembraneSynth().toDestination();
  hihat = new Tone.NoiseSynth({
    volume: -18,
    envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
  }).toDestination();

  recordingDestination = Tone.context.createMediaStreamDestination();
  Tone.Destination.connect(recordingDestination);

  Tone.Transport.bpm.value = 96;
}

export function getRecordingStream() {
  return recordingDestination.stream;
}

export function start(sensors) {
  melodyLoop = new Tone.Loop((time) => {
    const note = valueToNote(sensors.getMelodyValue());
    melodySynth.triggerAttackRelease(note, '8n', time);
    hihat.triggerAttackRelease('8n', time);
  }, '8n').start(0);

  chordLoop = new Tone.Loop((time) => {
    const chord = CHORD_PROGRESSION[valueToChordIndex(sensors.getChordValue())];
    bassSynth.triggerAttackRelease(chord.root, '2n', time);
    padSynth.triggerAttackRelease(chord.notes, '2n', time);
    kick.triggerAttackRelease('C1', '8n', time);
  }, '2n').start(0);

  Tone.Transport.start();
}

export function stop() {
  Tone.Transport.stop();
  if (melodyLoop) melodyLoop.dispose();
  if (chordLoop) chordLoop.dispose();
}
```

- [ ] **Step 2: Manually verify audio in a browser**

Run: `npx --yes serve . -l 5000`, open `http://localhost:5000` in Chrome.

In DevTools → Console, run:

```js
const audioMod = await import('./js/audio.js');
const sensors = await import('./js/sensors.js');
sensors.start();
await Tone.start();
audioMod.init();
audioMod.start(sensors);
```

Expected: within about a second you hear a repeating melody note, a soft sustained chord with a bass note every two beats, and a kick/hi-hat beat, all in tempo at 96 BPM. Use the DevTools Sensors panel (as in Task 3) to change orientation — expected: the melody note and chord audibly change without the beat stopping or glitching.

Run `audioMod.stop()` in the console. Expected: all sound stops.

Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 3: Commit**

```bash
git add js/audio.js
git commit -m "Add Tone.js synths, deterministic clock, and recording tap"
```

---

### Task 5: `recorder.js` — MediaRecorder wrapper with 2-minute cap

**Files:**
- Create: `js/recorder.js`

**Interfaces:**
- Consumes: a `MediaStream` (satisfied by `audio.getRecordingStream()` from Task 4).
- Produces:
  - `isSupported(): boolean`
  - `start(stream: MediaStream, onStop: (url: string) => void): void`
  - `stop(): void`
  - `getMaxDurationMs(): number`

- [ ] **Step 1: Write `js/recorder.js`**

```js
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
```

- [ ] **Step 2: Manually verify recording in a browser**

Run: `npx --yes serve . -l 5000`, open `http://localhost:5000` in Chrome.

In DevTools → Console, run:

```js
const audioMod = await import('./js/audio.js');
const sensors = await import('./js/sensors.js');
const recorder = await import('./js/recorder.js');
sensors.start();
await Tone.start();
audioMod.init();
audioMod.start(sensors);
recorder.start(audioMod.getRecordingStream(), (url) => console.log('recorded:', url));
```

Wait a few seconds, then run:

```js
recorder.stop();
```

Expected: the console logs `recorded: blob:http://localhost:5000/...`. Copy that URL and run `new Audio(url).play()` in the console (replace `url` with the logged string) — expected: it plays back the audio you just heard live, confirming the recording captured actual sound.

Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 3: Commit**

```bash
git add js/recorder.js
git commit -m "Add MediaRecorder wrapper with 2-minute auto-stop"
```

---

### Task 6: `app.js` — wire sensors, audio, and recorder to the UI

**Files:**
- Modify: `js/app.js` (replace the Task 1 stub)

**Interfaces:**
- Consumes: `sensors.{isSupported, requestPermission, start, getMelodyValue, getChordValue, getRawValues}`, `audio.{init, start, getRecordingStream}`, `recorder.{isSupported, start, stop, getMaxDurationMs}`, `mapping.{valueToNote, valueToChordIndex, CHORD_PROGRESSION}`, global `Tone.start()`. Binds to the DOM IDs from Task 1: `enable-btn`, `status`, `current-note`, `current-chord`, `x-bar`, `y-bar`, `record-btn`, `timer`, `download-link`.
- Produces: nothing (entry point, no exports needed).

- [ ] **Step 1: Replace `js/app.js`**

```js
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
  const granted = await sensors.requestPermission();
  if (!granted) {
    statusEl.textContent = 'Motion permission denied. Tap Enable again to retry.';
    return;
  }

  sensors.start();
  await Tone.start();
  audio.init();
  audio.start(sensors);

  statusEl.textContent = sensors.isSupported()
    ? 'Playing. Tilt your phone to change the music.'
    : 'No motion sensor detected - playing a fixed neutral note.';

  enableBtn.disabled = true;
  recordBtn.disabled = !recorder.isSupported();
  if (!recorder.isSupported()) {
    recordBtn.title = 'Recording is not supported in this browser.';
  }

  setInterval(updateReadout, 100);
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
```

- [ ] **Step 2: Manually verify the full app end-to-end in a browser**

Run: `npx --yes serve . -l 5000`, open `http://localhost:5000` in Chrome.

Click "Enable Motion & Audio". Expected: the status text updates to "Playing..." (or the no-sensor message on a desktop without `DeviceMotionEvent`), music starts playing, and the Note/Chord/X/Y readout begins updating roughly 10 times per second.

Open DevTools → Sensors panel and change orientation. Expected: the Note and Chord readout values change, matching what's audible.

Click "Record". Expected: the button label changes to "Stop" and a countdown starting near `2:00` appears and counts down.

Click "Stop" after a few seconds. Expected: the button returns to "Record", the countdown clears, and a "Download recording" link appears.

Click the download link. Expected: a `.webm` file downloads; open it in a media player and confirm it plays back the audio you heard live.

Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "Wire sensors, audio, and recorder to the UI"
```

---

### Task 7: Deploy to GitHub Pages via GitHub Actions and run real-device acceptance check

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:** none (final integration task; the workflow has no interface other than triggering on push to `main`).

- [ ] **Step 1: Create the GitHub Actions deployment workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit the workflow file**

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions workflow to deploy to GitHub Pages"
```

- [ ] **Step 3: Confirm with the user before pushing**

This step pushes commits to the shared `origin/main` and changes repository settings (switching GitHub Pages to build via GitHub Actions) — both affect shared/live state. Confirm with the user before proceeding, even though earlier tasks in this plan only touched the local working copy.

- [ ] **Step 4: Push to the remote**

```bash
git push -u origin main
```

Expected: push succeeds; `git status` shows the local `main` branch up to date with `origin/main`.

- [ ] **Step 5: Set the Pages source to GitHub Actions**

In a browser, go to `https://github.com/Ledsav/bump-music/settings/pages`. Under "Build and deployment", set Source to "GitHub Actions" (not "Deploy from a branch"). This is a one-time setting; from then on every push to `main` triggers the workflow from Step 1 to rebuild and republish the site automatically.

- [ ] **Step 6: Verify the workflow run and live deployment**

In a browser, go to `https://github.com/Ledsav/bump-music/actions` and confirm the "Deploy to GitHub Pages" workflow run triggered by the push completed successfully (green checkmark). If it failed, read the run's logs to diagnose before proceeding.

Once it succeeds, open `https://ledsav.github.io/bump-music/` in a browser.

Expected: the page loads over HTTPS with no console errors, matching what was verified locally in Task 6.

- [ ] **Step 7: Real-device acceptance check**

On an Android phone with Chrome, open `https://ledsav.github.io/bump-music/`:
- Tap "Enable Motion & Audio". Expected: music starts immediately (no permission prompt on Android).
- Tilt the phone left/right and forward/back. Expected: the Note and Chord readout and the audible melody/chords change with tilt; the beat keeps playing steadily throughout.
- Tap "Record", wait a few seconds, tap "Stop", tap the download link. Expected: a `.webm` file downloads to the phone and plays back the recorded audio.

On an iPhone with Safari, open the same URL:
- Tap "Enable Motion & Audio". Expected: iOS shows a motion-and-orientation-access permission prompt; tapping "Allow" starts the music. If denied, the status text shows the retry message and tapping "Enable Motion & Audio" again re-prompts.
- Repeat the tilt and record/download checks above. Expected: same behavior as Android.

- [ ] **Step 8: Report results**

Note any deviations found during the real-device check (e.g. audio glitches, permission issues) back to the user rather than silently working around them.
