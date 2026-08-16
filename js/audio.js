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
  melodySynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.1 },
  }).toDestination();
  bassSynth = new Tone.MonoSynth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.4 },
  }).toDestination();
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
