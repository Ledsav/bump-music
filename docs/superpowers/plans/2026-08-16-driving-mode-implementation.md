# Bump Music v2 — Driving Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Stop control, a live waveform visualizer, GPS/accelerometer-driven musical variants (Chill/Drive/Rough), and bumpiness-reactive percussion density to Bump Music, per `docs/superpowers/specs/2026-08-16-driving-mode-design.md`.

**Architecture:** Two new pure/testable modules (`js/variants.js`, and additions to `js/sensors.js`), one new browser-API wrapper module (`js/geolocation.js`), one new presentation-only module (`js/visualizer.js`), a rewritten `js/audio.js` (variant-aware init, percussion split onto its own tick-driven loop), a rewritten `js/app.js` (new Enable flow, Stop button, renamed record-toggle label), and a redesigned `index.html`/`style.css`. No build step, no new dependencies — same plain-ES-module architecture as v1.

**Tech Stack:** Same as v1 — HTML5, CSS3, vanilla JS (ES modules), Tone.js (CDN, major version 14), Web Audio `Tone.Analyser`, Geolocation API, Node's built-in test runner for pure-function modules.

## Global Constraints

- No `Math.random()` or any other nondeterministic source anywhere in the new code — bumpiness/jerk computation, variant classification, and percussion scheduling must all be pure functions of sensor/time history, exactly like v1.
- Variant table (exact values, from the spec):
  | Variant | Base tempo | Pad attack | Pad release | Pad volume |
  |---|---|---|---|---|
  | Chill | 84 | 1.2 | 2.5 | -14 |
  | Drive | 96 | 0.8 | 1.5 | -12 |
  | Rough | 108 | 0.3 | 0.8 | -10 |
- GPS speed thresholds: `< 2 m/s` → Chill, `2–15 m/s` → Drive, `> 15 m/s` → Rough.
- Accelerometer bumpiness thresholds (same tiers used both for one-time variant selection and continuous percussion density): `< 1.5` → low/Chill, `1.5–4` → medium/Drive, `> 4` → high/Rough.
- Percussion density by live bumpiness tier: **low** = kick on half notes + hi-hat on 8th notes (identical to v1); **medium** = kick on quarter notes + hi-hat on 8th notes; **high** = kick on quarter notes + hi-hat on 16th notes. Melody and chord/bass timing stay fixed on the session's base tempo regardless of tier.
- Variant selection happens once per session (right after Enable, before music starts): try geolocation with a 3-second timeout; if it returns a numeric speed, classify immediately; otherwise wait out a 5-second-total window (measured from Enable, not restarted) and classify the accelerometer's live bumpiness instead.
- Stop is a full reset: stops audio and the motion listener, finalizes any in-progress recording (so its download link still appears), and returns the UI to the initial Enable state. The Stop button stays visible and tappable even while a recording is in progress.
- The record-toggle's active-state label is **"Stop Recording"**, never bare "Stop" (to avoid colliding with the new Stop button).
- The waveform visualization is driven by the real live audio signal via `Tone.Analyser`, not a synthetic/event-driven shape.
- Raw X/Y numeric tilt readout is removed from the UI entirely (v1 had it; v2 does not).
- No manual variant-switching UI, no per-variant scale/instrument timbre changes (only tempo + pad envelope/volume differ between variants), no whole-track tempo ramping from live bumpiness.
- No build step, no npm dependencies — plain ES modules, same as v1.
- Portrait-first layout, CSS-flexible enough not to break in landscape.

---

### Task 1: `js/variants.js` — variant table and tier classification (TDD)

**Files:**
- Create: `js/variants.js`
- Test: `tests/variants.test.mjs`

**Interfaces:**
- Produces:
  - `VARIANTS: { chill: {...}, drive: {...}, rough: {...} }` where each entry is `{ name: string, baseTempo: number, pad: { attack: number, release: number, volume: number } }`
  - `bumpinessToTier(bumpiness: number): 'low' | 'medium' | 'high'`
  - `bumpinessToVariantKey(bumpiness: number): 'chill' | 'drive' | 'rough'`
  - `speedToVariantKey(speedMetersPerSecond: number): 'chill' | 'drive' | 'rough'`
- Consumes: nothing (pure module, no imports).

- [ ] **Step 1: Write the failing tests**

Create `tests/variants.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VARIANTS,
  bumpinessToTier,
  bumpinessToVariantKey,
  speedToVariantKey,
} from '../js/variants.js';

test('bumpinessToTier classifies low bumpiness', () => {
  assert.equal(bumpinessToTier(0), 'low');
  assert.equal(bumpinessToTier(1.49), 'low');
});

test('bumpinessToTier classifies medium bumpiness', () => {
  assert.equal(bumpinessToTier(1.5), 'medium');
  assert.equal(bumpinessToTier(4), 'medium');
});

test('bumpinessToTier classifies high bumpiness', () => {
  assert.equal(bumpinessToTier(4.01), 'high');
  assert.equal(bumpinessToTier(100), 'high');
});

test('speedToVariantKey classifies chill at walking/stopped speed', () => {
  assert.equal(speedToVariantKey(0), 'chill');
  assert.equal(speedToVariantKey(1.99), 'chill');
});

test('speedToVariantKey classifies drive at city speed', () => {
  assert.equal(speedToVariantKey(2), 'drive');
  assert.equal(speedToVariantKey(15), 'drive');
});

test('speedToVariantKey classifies rough at highway speed', () => {
  assert.equal(speedToVariantKey(15.01), 'rough');
  assert.equal(speedToVariantKey(40), 'rough');
});

test('bumpinessToVariantKey matches the same tier boundaries as bumpinessToTier', () => {
  assert.equal(bumpinessToVariantKey(0), 'chill');
  assert.equal(bumpinessToVariantKey(2), 'drive');
  assert.equal(bumpinessToVariantKey(10), 'rough');
});

test('VARIANTS has exactly chill, drive, rough with the required fields', () => {
  for (const key of ['chill', 'drive', 'rough']) {
    assert.ok(VARIANTS[key], `missing variant ${key}`);
    assert.equal(typeof VARIANTS[key].name, 'string');
    assert.equal(typeof VARIANTS[key].baseTempo, 'number');
    assert.equal(typeof VARIANTS[key].pad.attack, 'number');
    assert.equal(typeof VARIANTS[key].pad.release, 'number');
    assert.equal(typeof VARIANTS[key].pad.volume, 'number');
  }
});

test('VARIANTS values match the spec exactly', () => {
  assert.deepEqual(VARIANTS.chill, { name: 'Chill', baseTempo: 84, pad: { attack: 1.2, release: 2.5, volume: -14 } });
  assert.deepEqual(VARIANTS.drive, { name: 'Drive', baseTempo: 96, pad: { attack: 0.8, release: 1.5, volume: -12 } });
  assert.deepEqual(VARIANTS.rough, { name: 'Rough', baseTempo: 108, pad: { attack: 0.3, release: 0.8, volume: -10 } });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/variants.test.mjs`
Expected: FAIL — Node reports an error resolving `../js/variants.js` (module does not exist yet).

- [ ] **Step 3: Write `js/variants.js`**

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/variants.test.mjs`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add js/variants.js tests/variants.test.mjs
git commit -m "Add variant table and speed/bumpiness tier classification with unit tests"
```

---

### Task 2: `js/geolocation.js` — speed sample with timeout

**Files:**
- Create: `js/geolocation.js`

**Interfaces:**
- Produces:
  - `isSupported(): boolean`
  - `getSpeedSample(timeoutMs: number): Promise<number | null>` — resolves with `coords.speed` (meters/second) if available, or `null` if unsupported, denied, timed out, or the browser doesn't report a speed. Never rejects.
- Consumes: nothing custom (native `navigator.geolocation` only).

- [ ] **Step 1: Write `js/geolocation.js`**

```js
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
```

- [ ] **Step 2: Verify the Geolocation API usage**

There is no browser automation available in most environments running this plan. Verify by:
1. Running `node --check js/geolocation.js` to confirm valid syntax.
2. Using WebFetch or WebSearch to confirm the `navigator.geolocation.getCurrentPosition(success, error, options)` signature, the shape of `options.timeout`/`options.maximumAge`, and that `position.coords.speed` is `number | null` (MDN's Geolocation API and `GeolocationCoordinates.speed` reference pages). If the brief's usage doesn't match, report it as a concern rather than silently deviating.

- [ ] **Step 3: Commit**

```bash
git add js/geolocation.js
git commit -m "Add geolocation speed sampling with timeout, always resolves"
```

---

### Task 3: `js/sensors.js` — add jerk-based bumpiness signal (TDD for the pure part)

**Files:**
- Modify: `js/sensors.js`
- Modify: `tests/sensors.test.mjs`

**Interfaces:**
- Produces (new, in addition to v1's existing exports which are unchanged): `jerkMagnitude(dx: number, dy: number, dz: number): number` (pure), `getBumpiness(): number`.
- v1's existing exports (`smooth`, `isSupported`, `requestPermission`, `start`, `getMelodyValue`, `getChordValue`, `getRawValues`) keep their exact same names/signatures/behavior — this task only adds to the module, it does not change existing behavior.
- Consumes: nothing new (still only browser globals `window`, `DeviceMotionEvent`).

- [ ] **Step 1: Write the failing tests for `jerkMagnitude`**

Read the current `tests/sensors.test.mjs` first, then add these three tests to it (keep all existing tests unchanged):

```js
test('jerkMagnitude computes the Euclidean magnitude of the delta vector', () => {
  assert.equal(jerkMagnitude(3, 4, 0), 5);
});

test('jerkMagnitude is zero for no change', () => {
  assert.equal(jerkMagnitude(0, 0, 0), 0);
});

test('jerkMagnitude is deterministic for the same inputs', () => {
  assert.equal(jerkMagnitude(1, 2, 3), jerkMagnitude(1, 2, 3));
});
```

Add `jerkMagnitude` to the existing `import { smooth } from '../js/sensors.js';` line so it reads:

```js
import { smooth, jerkMagnitude } from '../js/sensors.js';
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `node --test tests/sensors.test.mjs`
Expected: the 3 new tests FAIL (`jerkMagnitude` is not exported yet); the existing 4 `smooth` tests still PASS.

- [ ] **Step 3: Modify `js/sensors.js`**

Replace the full file with:

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/sensors.test.mjs`
Expected: PASS — all 7 tests green (4 existing `smooth` tests + 3 new `jerkMagnitude` tests).

Then run the full suite to confirm no regressions:

Run: `node --test tests/*.test.mjs`
Expected: PASS — all tests across `mapping.test.mjs`, `sensors.test.mjs`, and `variants.test.mjs` (from Task 1) green.

- [ ] **Step 5: Commit**

```bash
git add js/sensors.js tests/sensors.test.mjs
git commit -m "Add jerk-based bumpiness signal to sensors.js"
```

---

### Task 4: `js/audio.js` — variant-aware init, split percussion loop, analyser tap

**Files:**
- Modify: `js/audio.js`

**Interfaces:**
- Consumes: `CHORD_PROGRESSION`, `valueToNote`, `valueToChordIndex` from `js/mapping.js`; `bumpinessToTier` from `js/variants.js`; global `Tone`; an object with `getMelodyValue(): number`, `getChordValue(): number`, `getBumpiness(): number` (satisfied by `js/sensors.js`).
- Produces (replaces v1's exports with this new signature set):
  - `init(variant: { baseTempo: number, pad: { attack: number, release: number, volume: number } }): void` — note the new required `variant` parameter (v1's `init()` took no arguments).
  - `start(sensors: { getMelodyValue(): number, getChordValue(): number, getBumpiness(): number }): void`
  - `stop(): void`
  - `getRecordingStream(): MediaStream`
  - `getAnalyser(): { getValue(): Float32Array | number[] }` (new — a `Tone.Analyser` instance, consumed by `js/visualizer.js` in Task 5)

- [ ] **Step 1: Research the Tone.Analyser API**

Before writing code, use WebFetch or WebSearch to confirm against Tone.js v14 documentation: the `new Tone.Analyser(type, size)` constructor (confirm `'waveform'` is a valid `type` and what `size` means), that a `Tone.Analyser` instance is connectable via `.connect()` like other Tone nodes (so `Tone.Destination.connect(analyser)` works the same way the existing `Tone.Destination.connect(recordingDestination)` pattern does), and the return type/shape of `.getValue()`. Report what you find — this determines exactly how `js/visualizer.js` (Task 5) will read from it.

- [ ] **Step 2: Write `js/audio.js`**

```js
import { CHORD_PROGRESSION, valueToNote, valueToChordIndex } from './mapping.js';
import { bumpinessToTier } from './variants.js';

let melodySynth;
let bassSynth;
let padSynth;
let kick;
let hihat;
let melodyLoop;
let chordLoop;
let percussionLoop;
let percussionTick;
let recordingDestination;
let analyser;

export function init(variant) {
  melodySynth = new Tone.Synth({ oscillator: { type: 'triangle' } }).toDestination();
  bassSynth = new Tone.MonoSynth({ oscillator: { type: 'sine' } }).toDestination();
  padSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: {
      attack: variant.pad.attack,
      decay: 0.2,
      sustain: 0.6,
      release: variant.pad.release,
    },
    volume: variant.pad.volume,
  }).toDestination();
  kick = new Tone.MembraneSynth().toDestination();
  hihat = new Tone.NoiseSynth({
    volume: -18,
    envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
  }).toDestination();

  recordingDestination = Tone.context.createMediaStreamDestination();
  Tone.Destination.connect(recordingDestination);

  analyser = new Tone.Analyser('waveform', 256);
  Tone.Destination.connect(analyser);

  Tone.Transport.bpm.value = variant.baseTempo;
}

export function getRecordingStream() {
  return recordingDestination.stream;
}

export function getAnalyser() {
  return analyser;
}

export function start(sensors) {
  if (melodyLoop) melodyLoop.dispose();
  if (chordLoop) chordLoop.dispose();
  if (percussionLoop) percussionLoop.dispose();
  percussionTick = 0;

  melodyLoop = new Tone.Loop((time) => {
    const note = valueToNote(sensors.getMelodyValue());
    melodySynth.triggerAttackRelease(note, '8n', time);
  }, '8n').start(0);

  chordLoop = new Tone.Loop((time) => {
    const chord = CHORD_PROGRESSION[valueToChordIndex(sensors.getChordValue())];
    bassSynth.triggerAttackRelease(chord.root, '2n', time);
    padSynth.triggerAttackRelease(chord.notes, '2n', time);
  }, '2n').start(0);

  percussionLoop = new Tone.Loop((time) => {
    const tier = bumpinessToTier(sensors.getBumpiness());
    const beatOf16 = percussionTick % 16;

    const kickOnThisTick = tier === 'low'
      ? (beatOf16 === 0 || beatOf16 === 8)
      : (beatOf16 % 4 === 0);
    if (kickOnThisTick) kick.triggerAttackRelease('C1', '8n', time);

    const hihatOnThisTick = tier === 'high' ? true : (beatOf16 % 2 === 0);
    if (hihatOnThisTick) hihat.triggerAttackRelease('16n', time);

    percussionTick++;
  }, '16n').start(0);

  Tone.Transport.start();
}

export function stop() {
  Tone.Transport.stop();
  if (melodyLoop) melodyLoop.dispose();
  if (chordLoop) chordLoop.dispose();
  if (percussionLoop) percussionLoop.dispose();
}
```

- [ ] **Step 3: Verify**

There is no browser automation available in most environments running this plan. Verify by:
1. Running `node --check js/audio.js` to confirm valid syntax.
2. Cross-checking `bumpinessToTier` is imported and called with the exact name/signature defined in Task 1's `js/variants.js`.
3. Hand-tracing the `percussionLoop` callback against the Global Constraints' percussion table for all three tiers at a few tick values (e.g. `percussionTick = 0, 4, 8, 12` for low and medium/high) to confirm kick fires on beats 1&3 only for `low` and on every beat for `medium`/`high`, and hihat fires every 8th note for `low`/`medium` and every 16th note for `high`.
4. Confirming `melodyLoop`/`chordLoop`/`percussionLoop` are all disposed at the top of `start()` before being recreated (same re-entrancy-safety pattern already established in v1 for `melodyLoop`/`chordLoop`), and that `stop()` disposes all three.

- [ ] **Step 4: Commit**

```bash
git add js/audio.js
git commit -m "Add variant-aware init, split percussion onto its own bumpiness-driven loop, add analyser tap"
```

---

### Task 5: `js/visualizer.js` — canvas waveform renderer

**Files:**
- Create: `js/visualizer.js`

**Interfaces:**
- Consumes: a canvas element and an analyser-like object with `getValue(): Float32Array | number[]` returning waveform samples in roughly the `-1..1` range (satisfied by `js/audio.js`'s `getAnalyser()` from Task 4 — confirm the exact return shape against what Task 4's research found).
- Produces:
  - `init(canvasEl: HTMLCanvasElement, analyserNode: { getValue(): Float32Array | number[] }): void`
  - `start(): void`
  - `stop(): void`

- [ ] **Step 1: Write `js/visualizer.js`**

```js
let canvas;
let ctx;
let analyser;
let rafId = null;

export function init(canvasEl, analyserNode) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  analyser = analyserNode;
}

export function start() {
  draw();
}

export function stop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function draw() {
  rafId = requestAnimationFrame(draw);

  const width = canvas.width;
  const height = canvas.height;
  const values = analyser.getValue();

  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#7dd3fc';
  ctx.shadowColor = '#7dd3fc';
  ctx.shadowBlur = 12;
  ctx.beginPath();

  const sliceWidth = width / values.length;
  let x = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const y = (v * 0.4 + 0.5) * height;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    x += sliceWidth;
  }
  ctx.stroke();
}
```

- [ ] **Step 2: Verify**

There is no browser automation available in most environments running this plan. Verify by:
1. Running `node --check js/visualizer.js` to confirm valid syntax.
2. Confirming the value-to-y-coordinate math: a `Tone.Analyser('waveform', ...)` sample range is `-1..1` (per Task 4's research) — `(v * 0.4 + 0.5) * height` maps `-1 → 0.1 * height` and `1 → 0.9 * height`, i.e. the waveform is drawn within the middle 80% of the canvas height, never touching the very top/bottom edges. Confirm this is a reasonable choice (not clipped, not too flat) and note it in your report.
3. Confirming `stop()` correctly cancels the animation frame loop (so it doesn't keep running/drawing after the app-level Stop button is pressed) and clears the canvas.

- [ ] **Step 3: Commit**

```bash
git add js/visualizer.js
git commit -m "Add canvas waveform visualizer driven by a Tone.Analyser"
```

---

### Task 6: Redesign `index.html` and `style.css`

**Files:**
- Modify: `index.html`
- Modify: `style.css`

**Interfaces:**
- Produces the final DOM element IDs Task 7 (`js/app.js`) binds to: `enable-btn`, `stop-btn`, `status`, `variant-badge`, `current-note`, `current-chord`, `waveform` (a `<canvas>`), `record-btn`, `timer`, `download-link`. This replaces v1's ID set (v1 additionally had `x-bar`/`y-bar`, which are removed per the spec — no later task needs them).

- [ ] **Step 1: Replace `index.html`**

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
    <div id="variant-badge">-</div>

    <section id="hero">
      <div id="current-note">-</div>
      <div id="current-chord">-</div>
    </section>

    <canvas id="waveform" width="320" height="120"></canvas>

    <p id="status">Tap the button to start.</p>

    <div id="entry-controls">
      <button id="enable-btn">Enable Motion &amp; Audio</button>
      <button id="stop-btn" style="display:none">Stop</button>
    </div>

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

- [ ] **Step 2: Replace `style.css`**

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
  background: #05060a;
  color: #f5f5f7;
}

main {
  width: 100%;
  max-width: 480px;
  padding: 28px 20px 40px;
  box-sizing: border-box;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

#variant-badge {
  align-self: center;
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #9ba3b4;
  background: rgba(255, 255, 255, 0.06);
  padding: 5px 16px;
  border-radius: 999px;
}

#hero {
  margin: 4px 0;
}

#current-note {
  font-size: 4rem;
  font-weight: 700;
  line-height: 1;
  background: linear-gradient(135deg, #7dd3fc, #5b8cff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

#current-chord {
  margin-top: 8px;
  font-size: 1.1rem;
  color: #b5b8c5;
  letter-spacing: 0.05em;
}

#waveform {
  width: 100%;
  height: 120px;
  border-radius: 16px;
  background: #0b0d12;
  display: block;
}

#status {
  min-height: 1.4em;
  color: #b5b8c5;
  font-size: 0.9rem;
}

#entry-controls,
#controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

button {
  font-size: 1rem;
  padding: 14px 28px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #5b8cff;
  color: white;
  cursor: pointer;
}

#stop-btn {
  background: rgba(255, 255, 255, 0.06);
  color: #e5e7eb;
}

#record-btn {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.3);
}

button:disabled {
  background: #3a3d47;
  color: #8a8d99;
  border-color: transparent;
  cursor: not-allowed;
}

#timer {
  font-variant-numeric: tabular-nums;
  color: #b5b8c5;
  font-size: 0.85rem;
}

#download-link {
  color: #7dd3fc;
  font-size: 0.9rem;
}
```

- [ ] **Step 3: Verify locally**

Run: `npx --yes serve . -l 5000`, open `http://localhost:5000` in a browser (or reason through the DOM structure statically if no browser is available in your environment).

Expected: the page renders the variant badge, hero note/chord placeholders, a dark rounded canvas, status text, an "Enable Motion & Audio" button (Stop hidden), and a disabled "Record" button — with no `js/app.js` errors beyond the expected ones from Task 6 not yet having a matching `js/app.js` (Task 7 replaces it next; if `js/app.js` still has Task 1's original v1 content at this point, note any console errors from ID mismatches in your report, but do not fix `js/app.js` here — that's Task 7's job).

Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 4: Commit**

```bash
git add index.html style.css
git commit -m "Redesign UI: variant badge, hero note/chord, waveform canvas, Stop control"
```

---

### Task 7: `js/app.js` — wire the new Enable flow, Stop, and variant selection

**Files:**
- Modify: `js/app.js` (full rewrite, replacing v1's content)

**Interfaces:**
- Consumes: `sensors.{isSupported, requestPermission, start, getMelodyValue, getChordValue, getBumpiness}` (Task 3), `audio.{init, start, stop, getRecordingStream, getAnalyser}` (Task 4), `recorder.{isSupported, start, stop, getMaxDurationMs}` (unchanged from v1), `geolocation.getSpeedSample` (Task 2), `visualizer.{init, start, stop}` (Task 5), `mapping.{valueToNote, valueToChordIndex, CHORD_PROGRESSION}` (unchanged), `variants.{VARIANTS, speedToVariantKey, bumpinessToVariantKey}` (Task 1), global `Tone.start()`. Binds to the DOM IDs from Task 6: `enable-btn`, `stop-btn`, `status`, `variant-badge`, `current-note`, `current-chord`, `record-btn`, `timer`, `download-link`, and passes the `waveform` canvas element to `visualizer.init`.
- Produces: nothing (entry point, no exports needed).

- [ ] **Step 1: Read the actual current source of every consumed module**

Before writing, read `js/sensors.js`, `js/audio.js`, `js/recorder.js`, `js/geolocation.js`, `js/visualizer.js`, `js/mapping.js`, `js/variants.js`, and `index.html` to confirm every function name, signature, and DOM ID this task assumes actually exists exactly as expected — don't assume, verify.

- [ ] **Step 2: Replace `js/app.js`**

```js
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
```

- [ ] **Step 3: Verify**

There is no browser automation available in most environments running this plan. Verify by:
1. Running `node --check js/app.js` to confirm valid syntax.
2. Cross-checking every function/property this file references against the actual exports read in Step 1 — list each one explicitly in your report.
3. Cross-checking every `document.getElementById(...)` call against the actual IDs in `index.html` — list each one explicitly.
4. Hand-tracing these scenarios and reporting what you find:
   - **Happy path with GPS speed available:** Enable tapped → permission granted → geolocation resolves a number within 3s → variant classified immediately from speed → `remaining`/`setTimeout` branch skipped entirely → music starts, variant badge shows the right name.
   - **Happy path with GPS unavailable/denied:** geolocation resolves `null` → waits out the rest of the 5-second window → classifies from `sensors.getBumpiness()` → proceeds.
   - **Stop while recording:** confirm `recorder.stop()` is called before `audio.stop()`/`visualizer.stop()`, and that hiding the Enable/Stop buttons and disabling `recordBtn` does not prevent the recorder's `onStop` callback (which fires asynchronously afterward) from still updating `downloadLink` — the download must still become available even though the UI has already returned to the Enable state.
   - **Unexpected exception mid-flow** (e.g. `Tone.start()` throws): caught by the `try/catch`, `enableBtn` re-enabled, recoverable status message shown — same pattern already established and reviewed in v1.
   - **iOS permission denied:** unchanged from v1 — guard only triggers when `sensors.isSupported()` is true, `enableBtn` re-enabled for retry.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "Wire new Enable flow (variant selection), Stop control, and renamed record-toggle label"
```

---

### Task 8: Deploy and run real-device acceptance check

**Files:** none (deployment already exists from v1's GitHub Actions workflow; this task only pushes and verifies).

**Interfaces:** none (final integration task).

- [ ] **Step 1: Run the full local test suite**

Run: `node --test tests/*.test.mjs`
Expected: PASS — all tests across `mapping.test.mjs`, `sensors.test.mjs`, and `variants.test.mjs` green, no regressions from any of this plan's 7 prior tasks.

- [ ] **Step 2: Confirm with the user before pushing**

This step pushes commits to the shared `origin/main`, which the existing GitHub Actions workflow (from v1) will automatically build and redeploy to the live Pages URL. Confirm with the user before proceeding, even though the prior tasks in this plan only touched the local working copy.

- [ ] **Step 3: Push to the remote**

```bash
git push origin main
```

Expected: push succeeds; `git status` shows the local `main` branch up to date with `origin/main`.

- [ ] **Step 4: Verify the workflow run and live deployment**

In a browser, go to `https://github.com/Ledsav/bump-music/actions` and confirm the "Deploy to GitHub Pages" workflow run triggered by this push completed successfully (green checkmark). If it failed, read the run's logs to diagnose before proceeding.

Once it succeeds, open `https://ledsav.github.io/bump-music/` and confirm the redesigned UI loads (variant badge, hero note/chord, waveform canvas, Enable button) with no console errors.

- [ ] **Step 5: Real-device acceptance check**

On a phone (Android Chrome and/or iOS Safari), open `https://ledsav.github.io/bump-music/` and check:
- **Variant selection:** tap Enable. If location permission is granted and you have a GPS speed reading (e.g. testing while actually moving), confirm the variant badge reflects your approximate speed (stopped/walking → Chill, driving/cycling → Drive, highway → Rough) reasonably quickly. If you deny location (or test somewhere GPS can't get a fix), confirm the status shows "Sampling road..." for a few seconds, then the badge shows a variant based on how much you shake/move the phone during that window (hold very still → Chill; shake it hard → Rough).
- **Live percussion density:** once playing, hold the phone still (percussion should be sparse — kick on 2 beats a bar, hi-hat on 8th notes) versus shaking it vigorously (percussion should audibly get busier — kick on every beat, hi-hat doubling up to 16th notes). Confirm it changes back and forth as you alternate.
- **Waveform:** confirm the canvas shows a live-updating glowing line that visibly responds to the music, and is legible on the actual device screen outdoors if possible (the scenario this whole redesign targets).
- **Stop:** tap Stop while playing (not recording) — confirm it fully returns to the Enable screen (badge/note/chord reset to `-`, Enable button reappears). Tap Enable again — confirm it's a fresh session (re-samples/re-checks for a new variant).
- **Stop mid-recording:** start a recording, then tap Stop (not Stop Recording) while it's still in progress — confirm a download link still appears for the partial recording, even though the screen has returned to the Enable state.
- **Record label:** confirm the button reads "Stop Recording" (not bare "Stop") while actively recording, so it's unambiguous next to the app-level Stop button.

- [ ] **Step 6: Report results**

Note any deviations found during the real-device check (e.g. thresholds feeling off, waveform legibility issues in sunlight, audio glitches) back to the user rather than silently working around them — the spec already flagged the GPS/bumpiness thresholds as likely needing real-world tuning.
