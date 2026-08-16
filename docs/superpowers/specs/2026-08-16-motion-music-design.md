# Bump Music — Motion-Driven Generative Music Web App

Date: 2026-08-16
Status: Approved

## Summary

A static, single-page web app, hosted on GitHub Pages, that reads a phone's
accelerometer in the browser and turns tilt/motion into live generative
music: a melody, a chord/bass accompaniment, and a steady drum beat, all
derived deterministically from the sensor readings. The user can record up
to 2 minutes of the resulting audio and download it as a file.

## Goals

- Runs entirely client-side, deployable as a static site on GitHub Pages
  (no backend, no build step required to deploy).
- Works on a single device: the device's own accelerometer drives its own
  audio. No cross-device streaming or multi-phone sync.
- Motion → music mapping is **stable and deterministic**: given the same
  sequence of accelerometer readings and elapsed time, the audio output is
  identical every time. No randomness anywhere in the mapping or scheduling.
- Produces genuinely musical output (in-key melody, consonant chords, a
  beat to lock to) rather than raw noise mapped to pitch.
- Supports both Android Chrome and iOS Safari, including iOS's explicit
  motion-permission prompt.
- Can record the live audio output (max 2 minutes) and download it as a
  file.

## Non-goals

- No multi-device or multi-user features (no phone-as-controller /
  separate-screen setup, no multi-phone jam sessions). Confirmed
  explicitly out of scope — see "Cross-device scope" decision below.
- No backend, database, or user accounts.
- No arbitrary scale/key/tempo customization UI in v1 (fixed musical
  parameters — see Musical Mapping).
- No automated end-to-end/browser testing (not practical for a
  sensor-driven page with no CI device farm).

## Architecture

Static site, plain ES modules, no bundler, no npm build step. Tone.js is
loaded from a CDN `<script>` tag. `index.html` lives at the repo root, and
GitHub Pages is configured to deploy from the `main` branch, root
directory — pushing to `main` is the entire deploy step.

### Files

- `index.html` — page shell: buttons, readout elements, script tags
  (Tone.js CDN + local ES modules).
- `style.css` — mobile-first styling for a single portrait screen.
- `js/sensors.js` — requests `devicemotion` permission (iOS 13+ flow),
  attaches the `devicemotion` listener, and exponentially smooths the raw
  x/y/z acceleration into two signals updated at different rates: a fast
  one for the melody axis and a slow one for the chord axis. Exposes
  current smoothed values via simple getters (no framework/pub-sub
  needed).
- `js/mapping.js` — pure functions only, no side effects: smoothed value →
  scale degree, smoothed value → chord index, plus the scale and chord
  progression data tables. Independently unit-testable.
- `js/audio.js` — builds the Tone.js synths (melody, bass, pad, kick,
  hi-hat), owns the deterministic `Tone.Transport` clock, and on each tick
  reads the current values from `sensors.js`/`mapping.js` and triggers the
  appropriate notes. Also sets up the `MediaStreamAudioDestinationNode` tap
  used for recording.
- `js/recorder.js` — wraps `MediaRecorder` against the tapped stream:
  start/stop, a 2-minute auto-stop timer, and Blob → downloadable-link
  handling (revokes the previous object URL on each new recording).
- `js/app.js` — wires DOM buttons to the above modules and updates the
  on-screen readout (current note, current chord, raw/smoothed axis
  values) each tick.

## Decisions from design discussion

- **Cross-device scope**: single device only. The phone reads its own
  sensor and plays its own audio in the same browser tab. "Cross-device"
  in the original research just meant "works on any phone," not
  multi-device streaming — that would require a backend/relay and was
  explicitly ruled out to keep this a pure static site.
- **Sonification style**: quantized to a musical scale and a fixed tempo
  grid, not continuous/theremin-style pitch. This is what makes the output
  "stable" — small hand jitter gets filtered by smoothing and then
  quantization, rather than constantly wobbling the pitch.
- **Accompaniment source**: also motion-derived, via a second axis smoothed
  at a much slower rate than the melody axis, rather than a fixed
  autonomous backing track. Both melody and chords respond to tilt, but at
  different speeds.
- **Audio engine**: Tone.js (via CDN), not raw Web Audio API — trades one
  external script dependency for much less hand-written scheduling/synth
  code.
- **Recording**: `MediaRecorder` capturing the live Tone.js output as
  WebM/Opus, not an offline WAV render. Simpler pipeline; output format is
  WebM/Opus rather than a universal WAV/MP3.
- **iOS support**: explicitly supported. A single "Enable Motion & Audio"
  button both requests iOS's motion permission and unlocks the
  `AudioContext` (both require a user gesture anyway, so one button serves
  both).
- **Visual feedback**: minimal — current note/chord name plus a live tilt
  readout. No canvas visualizer, no bare "no feedback at all" option.
- **Percussion**: a steady kick/hi-hat pattern on the same fixed
  `Tone.Transport` clock as the melody trigger grid — not driven by shake
  intensity, so there's always a beat even when the phone is held still.
- **Code architecture**: modular static files (Option B) — separate
  `sensors.js` / `mapping.js` / `audio.js` / `recorder.js` / `app.js` as
  plain ES modules — rather than one giant `index.html` or a bundled
  npm/Vite app. No build step, still deploys straight to GitHub Pages.

## Musical mapping (core logic)

**Input signals**: `devicemotion`'s `accelerationIncludingGravity` gives
x/y/z. Because gravity is included, tilting the phone shifts how gravity's
9.8 m/s² is distributed across the three axes, so even a motionless tilt
produces a stable, distinct reading per axis — this is what makes
quantized-and-deterministic mapping work, as opposed to using pure
linear acceleration (which is ~0 when still).

- **Melody axis — x (left-right tilt)**: smoothed with a fast exponential
  moving average (enough to remove sensor jitter, but still responsive to
  intentional tilting), then quantized to the nearest note of a **C major
  pentatonic scale** (C D E G A) spanning roughly 1.5 octaves.
- **Chord/bass axis — y (front-back tilt)**: smoothed with a much slower
  exponential moving average, then quantized into 4 buckets mapped to a
  fixed progression: **I–V–vi–IV in C major (C–G–Am–F)**. C major
  pentatonic is consonant against all four of these chords, so the melody
  never clashes no matter which chord is currently active.
- **Rhythm/clock**: a fixed `Tone.Transport` running at **96 BPM** — not
  sensor-driven — provides the timing grid:
  - Every 8th note: the melody synth samples the currently quantized note
    from the x axis and plays it.
  - Every beat 1 and 3 (i.e. twice per bar): the bass synth plays the
    current chord's root note, and a pad synth (soft attack, sustained)
    plays the chord's full triad.
  - Kick and hi-hat play a simple fixed pattern on the same clock (e.g.
    kick on beats 1 and 3, hi-hat on every 8th note) using
    `Tone.MembraneSynth` / `Tone.NoiseSynth`.

**Determinism guarantee**: no `Math.random()` or other nondeterministic
source is used anywhere in sensor smoothing, quantization, or scheduling.
Given an identical sequence of accelerometer readings arriving at
identical times, the audio output is bit-for-bit identical, because
smoothing, quantization, and the transport clock are all pure functions of
input history and elapsed time.

## Recording & download

The Tone.js master output is tapped into a
`MediaStreamAudioDestinationNode` in parallel with the normal speaker
output (speakers keep playing; the tap is purely additional routing). That
stream feeds a `MediaRecorder` using `audio/webm;codecs=opus` (with a
`MediaRecorder.isTypeSupported` check and fallback/disable if unsupported).

- Recording is capped at **2 minutes** via a timer that calls `stop()`
  automatically; a manual Stop button also works at any time.
- On stop, the recorded chunks are assembled into a `Blob`, exposed as a
  download link named `bump-music-<timestamp>.webm`.
- Each new recording revokes the previous `Blob` object URL before
  creating a new one, to avoid leaking memory across repeated
  record/download cycles.

## UI

Minimal, mobile-first, single portrait screen:

- **"Enable Motion & Audio" button** — the one user-gesture that both
  requests iOS's `DeviceMotionEvent.requestPermission()` (when present)
  and unlocks the Tone.js `AudioContext` (`Tone.start()`). Once granted,
  music starts playing immediately — holding the phone flat plays the
  default/center note and chord.
- **Live readout** — current melody note name, current chord name, and
  small numeric/bar indicators for the raw and smoothed x/y values (useful
  for understanding and debugging the mapping while using the app).
- **Record / Stop button**, with a visible countdown while recording (max
  2:00).
- **Download link** — appears once a recording is finished; replaced by a
  fresh one on each new recording.

## Error handling

- **No `devicemotion` support** (e.g. a desktop browser without motion
  sensors): the app still runs, using a fixed neutral reading (as if the
  phone were held flat) instead of crashing or hanging, with a visible
  notice that live motion isn't available on this device.
- **iOS permission denied**: shows an explanation of why motion access is
  needed, with a retry button (iOS allows re-prompting on a subsequent tap
  after a denial, though the user may need to change a Safari setting if
  denied more than once).
- **`MediaRecorder` / stream-capture unsupported**: the Record button is
  disabled with an explanatory message, rather than failing silently or
  throwing when pressed.

## Testing

No CI/build pipeline exists (or is planned) for this project, and
sensor-driven behavior can't be meaningfully exercised in an automated
browser test without real device motion. Plan:

- `mapping.js` is pure functions with no side effects (value → scale
  degree, value → chord index) — these get lightweight, framework-free
  unit tests (plain JS assertions run via Node), since they're
  deterministic and don't touch the DOM or sensors.
- Everything else (sensor permission flow, audio scheduling, recording) is
  verified manually on real devices — Chrome on Android and Safari on iOS
  — via a checklist during implementation: permission prompt appears and
  works, tilting changes the note/chord audibly and in the readout,
  Record → Stop/auto-stop-at-2:00 → Download produces a file that plays
  back the recorded audio correctly.
