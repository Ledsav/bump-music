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
