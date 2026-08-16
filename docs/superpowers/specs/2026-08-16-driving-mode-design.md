# Bump Music v2 — Driving Mode (Stop Control, Waveform Visualizer, Road-Aware Variants)

Date: 2026-08-16
Status: Approved

## Summary

A follow-up feature set for Bump Music (the motion-driven generative music
web app — see `2026-08-16-motion-music-design.md` for the original
architecture) aimed at real use on a phone mounted on a dashboard/handlebar
stand while moving: a proper Stop control, a full-screen glanceable
waveform visualization in place of the raw numeric readout, a small set of
musical "variants" chosen automatically from how fast/rough the ride is,
and live percussion that gets busier as the road gets bumpier.

## Goals

- Add a **Stop** control that fully halts the app (audio + sensors +
  finalizes any in-progress recording) and returns to the initial Enable
  screen, without colliding in name with the existing record/stop-recording
  toggle.
- Replace the raw X/Y debug readout with a **glanceable, full-width
  waveform visualization** driven by the actual live audio signal, styled
  to stay legible on a phone screen in bright sunlight from arm's length.
- Automatically pick one of **three musical variants — Chill / Drive /
  Rough** — once per session, based on how fast or rough the current
  motion is (GPS speed if available, accelerometer roughness otherwise).
  Each variant sets a different base tempo and instrument feel.
- Make **percussion density** respond live and continuously to road
  roughness (independent of which variant is active): smoother road →
  sparser beat, bumpier road → busier beat. Melody and chord timing stay
  on the session's fixed base tempo — only percussion subdivides faster.
- Keep the whole thing portrait-first but not broken in landscape.

## Non-goals

- No manual variant switching UI — selection is automatic, once per
  session, at Enable time.
- No distinct scales or instrument timbres per variant — variants differ
  by base tempo and instrument envelope/volume only (kept simple
  deliberately, per the "3 variants: Chill/Drive/Rough" decision over the
  "4+ variants with distinct scales/instruments" alternative).
- No whole-track tempo ramping from live bumpiness — only percussion
  density changes in real time; base tempo is fixed for the session once
  the variant is chosen.
- No caching/reuse of a previous session's variant or GPS fix — every
  fresh tap of Enable re-runs variant selection from scratch, consistent
  with Stop being a full reset.
- No raw waveform/oscilloscope-quality audio analysis — the visualizer
  uses a standard Web Audio `AnalyserNode` (via `Tone.Analyser`), not a
  custom DSP pipeline.

## A note on determinism

The original spec's core principle — tilt-to-note/chord mapping is a pure,
deterministic function of sensor history and elapsed time, no
`Math.random()` — is unchanged and still fully applies to melody, chords,
and the beat *within* a session. This feature adds one deliberate,
documented exception: **which variant a session starts in** can depend on
a live GPS speed reading, which is external, real-world state, not a pure
function of prior inputs. This is a conscious one-time "session seed," not
a source of ongoing randomness — once a variant is picked, everything
downstream (notes, chords, percussion density) remains exactly as
deterministic as before, driven only by the accelerometer.

## Decisions from design discussion

- **Stop button**: full stop back to the Enable screen (audio + sensors
  fully halted; tapping Enable again is a completely fresh session), not a
  pause/resume-in-place toggle.
- **Naming collision**: the existing record-toggle's active-state label
  changes from "Stop" to **"Stop Recording"** so it never reads the same
  as the new app-level "Stop" button.
- **Visualization style**: a full-width glowing waveform line (chosen over
  a pulsing orb, EQ bars, or a full-screen ambient color wash), driven by
  the real live audio signal via `Tone.Analyser`, not a synthetic
  event-driven shape — automatically reflects melody + chords + percussion
  together with no extra mapping logic. Rendered thick with a glow and on
  a solid dark background specifically to stay legible in bright outdoor
  light (the one risk explicitly flagged when this style was picked).
- **On-screen info**: current note + chord in large hero text, and the
  active variant name as a small badge, both kept. Raw X/Y tilt numbers
  are dropped from this polished view (they were a Task-6-era debugging
  aid, not meant for end-user consumption).
- **Variant trigger signal**: GPS speed when available (fastest, most
  directly tied to actual travel speed); accelerometer-based roughness
  sampling as the fallback when geolocation is denied, unsupported, or
  doesn't return a speed.
- **Variant → tier mapping basis**: GPS speed thresholds and accelerometer
  roughness thresholds (below) are reasonable starting points based on
  physical reasoning, not device-calibrated — flagged as likely needing
  real-world tuning once tested on an actual moving vehicle/bike.
- **Live bumpiness scope**: affects percussion density only, not the
  overall tempo — keeps the melody/chords recognizable and stable while
  still giving a physically-responsive beat.
- **Screen orientation**: portrait-first, CSS-flexible enough not to break
  in landscape, no orientation-specific logic.
- **Layout**: approved via mockup — variant badge, hero note/chord text,
  full-width waveform strip, then a Stop + Record button row (with a
  countdown replacing the row when recording).

## Variant selection flow

Triggered once, immediately after tapping Enable, before music starts:

1. If `navigator.geolocation` doesn't exist, skip straight to step 3 (no
   point waiting on an API that isn't there).
2. Otherwise, request the current position with a **3-second timeout**.
   Simultaneously (not sequentially), motion listening already starts
   accumulating its live "bumpiness" signal (see below) — so the two
   approaches race rather than stack, capping total worst-case wait at 5
   seconds instead of 3+5.
   - If geolocation resolves within the timeout with a numeric
     `coords.speed`, classify it immediately using the GPS thresholds
     below and proceed to step 4 — no need to wait out the rest of the
     5-second accelerometer window.
   - If geolocation is denied, errors, times out, or resolves without a
     usable speed value, fall through to step 3.
3. Show a **"Sampling road..."** status message and wait until 5 seconds
   have elapsed since Enable was tapped (accounting for time already spent
   attempting geolocation), then read the accelerometer's live smoothed
   bumpiness value and classify it using the accelerometer thresholds
   below.
4. Start the session with the chosen variant's base tempo and instrument
   settings (see Variant table below), then start audio/music normally.

**GPS speed thresholds** (`coords.speed` is meters/second per the
Geolocation API):
- `< 2 m/s` (≈ walking pace or stopped) → **Chill**
- `2–15 m/s` (≈ city driving/cycling) → **Drive**
- `> 15 m/s` (≈ highway speed) → **Rough**

**Accelerometer roughness thresholds** (using the same smoothed
"bumpiness" signal described below, sampled after the 5-second warm-up
window):
- `< 1.5` → **Chill**
- `1.5–4` → **Drive**
- `> 4` → **Rough**

If neither signal is available at all (e.g. testing on a desktop browser
with no motion sensor and no geolocation), the bumpiness signal stays at
its neutral default (0), which classifies as **Chill** — a graceful
default consistent with the original spec's "no sensor support → neutral
reading" behavior, not a crash or a stuck loading state.

## Variant table

| Variant | Base tempo | Pad envelope | Feel |
|---|---|---|---|
| Chill | 84 BPM | longer attack/release, softer | calm, ambient |
| Drive | 96 BPM | today's default envelope | balanced (unchanged from v1) |
| Rough | 108 BPM | shorter attack/release, slightly louder kick/hihat | punchier, urgent |

Melody scale, chord progression, and the tilt-to-note/chord mapping itself
are unchanged across variants — only tempo and instrument
envelope/volume differ, per the "keep it simple" decision.

## Live bumpiness → percussion density

Continuously, for the whole session, independent of which variant is
active: the accelerometer's raw axis readings are used to compute
"jerk" — the magnitude of change between consecutive readings — which is
then smoothed with the same style of exponential moving average already
used elsewhere in the app (deterministic, no randomness), producing one
continuously-updated "bumpiness" value. That value is classified into the
same three tiers as above (Low/Medium/High, using the accelerometer
roughness thresholds) to drive percussion density:

- **Low** bumpiness: kick on half notes, hi-hat on 8th notes (identical to
  v1's fixed pattern)
- **Medium** bumpiness: kick on quarter notes, hi-hat on 8th notes
- **High** bumpiness: kick on quarter notes, hi-hat on 16th notes

Melody and chord/bass timing are unaffected — they remain on the fixed
8th-note / half-note grid at the session's base tempo, exactly as in v1.
This tier can change many times during a single session as road
conditions change; it is entirely separate from the once-per-session
variant selection.

## Visualization

A full-width waveform strip rendered on a `<canvas>`, fed by a
`Tone.Analyser` tapped from the live audio output in parallel with both
the speaker output and the existing recording tap (three parallel
destinations off the same audio graph, none silencing the others — same
non-exclusive `connect()` pattern already used for recording in v1). A
`requestAnimationFrame` loop reads the analyser's current waveform samples
each frame and draws them as a single thick, glowing line, so it reflects
melody + chords + percussion together automatically with no manual
event-to-visual mapping to build or tune.

## UI

Portrait-first, approved layout (see mockup discussed in brainstorming):

- Small **variant badge** ("Chill" / "Drive" / "Rough") at the top,
  updates once at session start and stays fixed for the session.
- **Hero text**: current melody note (large) and current chord (smaller,
  beneath it) — unchanged content from v1, restyled larger/bolder for
  distance legibility.
- **Waveform strip**: full width, dark background, thick glowing line.
- **Controls row**: Stop button and Record button side by side. While
  recording, the Record button's label changes to "Stop Recording" and a
  countdown appears beneath the row — but the **Stop button stays visible
  and tappable throughout**, so a mid-recording Stop is always reachable
  (matching the Error Handling case below). A Download link appears once
  a recording finishes, as in v1.
- Raw X/Y numeric readout is removed from this view entirely.

## Error handling (additions to v1's existing cases)

- **Geolocation denied, errors, or times out**: treated identically to
  "unsupported" — falls through to the accelerometer-sampling path with
  no separate error UI; the "Sampling road..." message already covers
  this case naturally.
- **Neither geolocation nor accelerometer available**: after the 5-second
  wait, the neutral (0) bumpiness value classifies as Chill by the
  thresholds above — the session still starts normally, it just always
  starts in the calmest variant. No crash, no indefinite stuck state.
- **Stop pressed mid-recording**: Stop finalizes (stops) any in-progress
  recording before tearing down audio/sensors, so the download link is
  still produced rather than the recording being silently discarded.

## Testing

Same approach as v1: the accelerometer roughness/jerk calculation and the
speed/bumpiness → variant-tier classification are pure functions and get
Node-based unit tests (no DOM/browser dependency), following the existing
`tests/mapping.test.mjs` / `tests/sensors.test.mjs` pattern. Geolocation
API calls, the `Tone.Analyser` visualization, and end-to-end UI/audio
behavior (Stop button, variant selection racing logic, live percussion
density changes) are verified manually/on a real device, per the existing
project pattern — automated browser testing isn't practical for this kind
of sensor-and-audio-driven page.
