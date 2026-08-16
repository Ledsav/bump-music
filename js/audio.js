import { CHORD_PROGRESSION, valueToChordIndex, valueToNote } from './mapping.js';
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
let limiter;

export function init(variant) {
  limiter = new Tone.Limiter(-6).toDestination();

  melodySynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.1 },
    volume: -8,
  }).connect(limiter);
  bassSynth = new Tone.MonoSynth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.4 },
    volume: -8,
  }).connect(limiter);
  padSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: {
      attack: variant.pad.attack,
      decay: 0.2,
      sustain: 0.6,
      release: variant.pad.release,
    },
    volume: variant.pad.volume,
  }).connect(limiter);
  kick = new Tone.MembraneSynth({ volume: -6 }).connect(limiter);
  hihat = new Tone.NoiseSynth({
    volume: -20,
    envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
  }).connect(limiter);

  recordingDestination = Tone.context.createMediaStreamDestination();
  Tone.Destination.connect(recordingDestination);

  analyser = new Tone.Analyser('waveform', 1024);
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
