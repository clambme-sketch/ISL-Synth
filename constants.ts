import type { SynthPreset, FilterSettings, ReverbSettings, DelaySettings, SaturationSettings, ChorusSettings, PhaserSettings, LFOSettings } from './types';

export const NOTE_FREQUENCIES: { [note: string]: number } = {
    'C1': 32.70, 'C#1': 34.65, 'D1': 36.71, 'D#1': 38.89, 'E1': 41.20, 'F1': 43.65, 'F#1': 46.25, 'G1': 49.00, 'G#1': 51.91, 'A1': 55.00, 'A#1': 58.27, 'B1': 61.74,
    'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
    'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
    'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
    'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
    'C6': 1046.50, 'C#6': 1108.73, 'D6': 1174.66, 'D#6': 1244.51, 'E6': 1318.51, 'F6': 1396.91, 'F#6': 1479.98, 'G6': 1567.98, 'G#6': 1661.22, 'A6': 1760.00, 'A#6': 1864.66, 'B6': 1975.53,
    'C7': 2093.00, 'C#7': 2217.46, 'D7': 2349.32, 'D#7': 2489.02, 'E7': 2637.02, 'F7': 2793.83, 'F#7': 2959.96, 'G7': 3135.96, 'G#7': 3322.44, 'A7': 3520.00, 'A#7': 3729.31, 'B7': 3951.07,
};

export const SHARP_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_KEYS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

export const SHARP_TO_FLAT: { [key: string]: string } = {
    'C#': 'D♭', 'D#': 'E♭', 'F#': 'G♭', 'G#': 'A♭', 'A#': 'B♭'
};
export const FLAT_TO_SHARP: { [key: string]: string } = {
    'D♭': 'C#', 'E♭': 'D#', 'G♭': 'F#', 'A♭': 'G#', 'B♭': 'A#'
};

export const SOLFEGE_SYLLABLES_SHARP: { [interval: number]: string } = {
    0: 'Do', 1: 'Di', 2: 'Re', 3: 'Ri', 4: 'Mi', 5: 'Fa',
    6: 'Fi', 7: 'Sol', 8: 'Si', 9: 'La', 10: 'Li', 11: 'Ti'
};

export const SOLFEGE_SYLLABLES_FLAT: { [interval: number]: string } = {
    0: 'Do', 1: 'Ra', 2: 'Re', 3: 'Me', 4: 'Mi', 5: 'Fa',
    6: 'Se', 7: 'Sol', 8: 'Le', 9: 'La', 10: 'Te', 11: 'Ti'
};

export const KEYBOARD_NOTES: { note: string; type: 'white' | 'black' }[] = [
    { note: 'C4', type: 'white' }, { note: 'C#4', type: 'black' }, { note: 'D4', type: 'white' }, { note: 'D#4', type: 'black' }, { note: 'E4', type: 'white' }, { note: 'F4', type: 'white' }, { note: 'F#4', type: 'black' }, { note: 'G4', type: 'white' }, { note: 'G#4', type: 'black' }, { note: 'A4', type: 'white' }, { note: 'A#4', type: 'black' }, { note: 'B4', type: 'white' },
    { note: 'C5', type: 'white' }, { note: 'C#5', type: 'black' }, { note: 'D5', type: 'white' }, { note: 'D#5', type: 'black' }, { note: 'E5', type: 'white' }, { note: 'F5', type: 'white' },
];

export const KEY_MAP: { [key: string]: string } = {
    'a': 'C4', 's': 'D4', 'd': 'E4', 'f': 'F4', 'g': 'G4', 'h': 'A4', 'j': 'B4',
    'w': 'C#4', 'e': 'D#4', 't': 'F#4', 'y': 'G#4', 'u': 'A#4',
    'k': 'C5', 'l': 'D5', ';': 'E5', "'": 'F5',
    'o': 'C#5', 'p': 'D#5',
};

export const JUST_INTONATION_RATIOS = [
  1/1, 16/15, 9/8, 6/5, 5/4, 4/3, 45/32, 3/2, 8/5, 5/3, 9/5, 15/8,
];

export const ALL_NOTES_CHROMATIC = Object.keys(NOTE_FREQUENCIES);

export const DEFAULT_FILTER_SETTINGS: FilterSettings = { on: false, type: 'lowpass', cutoff: 8000, resonance: 1 };
export const DEFAULT_REVERB_SETTINGS: ReverbSettings = { on: false, mix: 0.3, decay: 1.5 };
export const DEFAULT_DELAY_SETTINGS: DelaySettings = { on: false, mix: 0.4, time: 0.5, feedback: 0.4 };
export const DEFAULT_SATURATION_SETTINGS: SaturationSettings = { on: false, mix: 0.5, drive: 0.5 };
export const DEFAULT_CHORUS_SETTINGS: ChorusSettings = { on: false, mix: 0.4, rate: 1.5, depth: 0.7 };
export const DEFAULT_PHASER_SETTINGS: PhaserSettings = { on: false, mix: 0.5, rate: 1.2, depth: 0.8, baseFrequency: 350 };
export const DEFAULT_LFO_SETTINGS: LFOSettings = { on: false, waveform: 'sine', rate: 5, depth: 0.2, target: 'pitch' };

export const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
export const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11]; // W-W-H-W-W-W-H
export const MAJOR_SCALE_CHORD_QUALITIES = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'];
export const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // Natural Minor: W-H-W-W-H-W-W
export const MINOR_SCALE_CHORD_QUALITIES = ['minor', 'diminished', 'major', 'minor', 'major', 'major', 'major'];


export const SYNTH_PRESETS: SynthPreset[] = [
  // --- Simple/Basic ---
  {
    name: 'Simple Sine',
    adsr: { attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.4 },
    osc1: { waveform: 'sine', detune: 0, octave: 0 },
    osc2: { waveform: 'sine', detune: 0, octave: 0 },
    mix: 0,
    singleOscillator: true,
    reverb: { on: true, mix: 0.1, decay: 1.0 },
  },
  {
    name: 'Simple Square',
    adsr: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.2 },
    osc1: { waveform: 'square', detune: 0, octave: 0 },
    osc2: { waveform: 'square', detune: 0, octave: 0 },
    mix: 0,
    singleOscillator: true,
  },
  {
    name: 'Simple Saw',
    adsr: { attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.4 },
    osc1: { waveform: 'sawtooth', detune: 0, octave: 0 },
    osc2: { waveform: 'sawtooth', detune: 0, octave: 0 },
    mix: 0,
    singleOscillator: true,
  },
  {
    name: 'Simple Triangle',
    adsr: { attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.4 },
    osc1: { waveform: 'triangle', detune: 0, octave: 0 },
    osc2: { waveform: 'triangle', detune: 0, octave: 0 },
    mix: 0,
    singleOscillator: true,
  },

  // --- Keys & Plucked ---
  {
    name: 'Electric Piano',
    adsr: { attack: 0.02, decay: 0.5, sustain: 0.4, release: 0.8 },
    osc1: { waveform: 'sine', detune: -5, octave: 0 },
    osc2: { waveform: 'sine', detune: 5, octave: 1 },
    mix: 0.6,
    chorus: { on: true, mix: 0.25, rate: 0.8, depth: 0.5 },
    reverb: { on: true, mix: 0.2, decay: 1.0 },
    lfo: { on: true, waveform: 'sine', rate: 4, depth: 0.15, target: 'amplitude' }, // Tremolo
  },
  {
    name: 'Space Organ',
    adsr: { attack: 0.02, decay: 0.1, sustain: 0.9, release: 0.2 },
    osc1: { waveform: 'sine', detune: 0, octave: 0 },
    osc2: { waveform: 'sine', detune: 8, octave: 1 },
    mix: 0.4,
    phaser: { on: true, mix: 0.3, rate: 0.5, depth: 0.4, baseFrequency: 800 },
    reverb: { on: true, mix: 0.3, decay: 2.0 },
  },
  {
    name: 'Funk Clav',
    adsr: { attack: 0.01, decay: 0.25, sustain: 0.0, release: 0.3 },
    osc1: { waveform: 'sawtooth', detune: -5, octave: 0 },
    osc2: { waveform: 'sawtooth', detune: 5, octave: 0 },
    mix: 0.5,
    filter: { on: true, type: 'highpass', cutoff: 300, resonance: 1.5 },
    phaser: { on: true, mix: 0.4, rate: 0.8, depth: 0.5, baseFrequency: 1200 },
    reverb: { on: true, mix: 0.15, decay: 0.5 },
  },
  {
    name: 'Percussive Marimba',
    adsr: { attack: 0.01, decay: 0.2, sustain: 0.0, release: 0.2 },
    osc1: { waveform: 'sine', detune: 0, octave: 0 },
    osc2: { waveform: 'sine', detune: 0, octave: 2 },
    mix: 0.3,
    reverb: { on: true, mix: 0.25, decay: 0.8 },
  },

  // --- Pads ---
  {
    name: 'Lush Pad',
    adsr: { attack: 0.8, decay: 1.2, sustain: 0.7, release: 2.0 },
    osc1: { waveform: 'triangle', detune: -13, octave: 0 },
    osc2: { waveform: 'sawtooth', detune: 13, octave: -1 },
    mix: 0.4,
    filter: { on: true, type: 'lowpass', cutoff: 2800, resonance: 1.5 },
    reverb: { on: true, mix: 0.4, decay: 3.5 },
    chorus: { on: true, mix: 0.5, rate: 0.4, depth: 0.7 },
    lfo: { on: true, waveform: 'sine', rate: 0.3, depth: 0.25, target: 'filter' }, // Slow filter sweep
  },
  {
    name: 'Dream Pad',
    adsr: { attack: 1.2, decay: 0.8, sustain: 0.8, release: 1.8 },
    osc1: { waveform: 'sine', detune: -10, octave: 0 },
    osc2: { waveform: 'sine', detune: 10, octave: 1 },
    mix: 0.6,
    filter: { on: true, type: 'lowpass', cutoff: 3500, resonance: 1.0 },
    reverb: { on: true, mix: 0.5, decay: 3.0 },
    delay: { on: true, mix: 0.25, time: 0.6, feedback: 0.4 },
  },
  {
    name: 'Cinematic Pad',
    adsr: { attack: 1.5, decay: 1.5, sustain: 0.8, release: 2.8 },
    osc1: { waveform: 'sine', detune: -12, octave: 0 },
    osc2: { waveform: 'sawtooth', detune: 12, octave: 1 },
    mix: 0.6,
    filter: { on: true, type: 'lowpass', cutoff: 2500, resonance: 2 },
    reverb: { on: true, mix: 0.5, decay: 4.5 },
    phaser: { on: true, mix: 0.4, rate: 0.15, depth: 0.7, baseFrequency: 600 },
  },

  // --- Lead ---
  {
    name: 'Classic Lead',
    adsr: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.4 },
    osc1: { waveform: 'sawtooth', detune: -7, octave: 0 },
    osc2: { waveform: 'sawtooth', detune: 7, octave: 0 },
    mix: 0.5,
    delay: { on: true, mix: 0.25, time: 0.4, feedback: 0.35 },
    reverb: { on: true, mix: 0.15, decay: 1.2 },
    lfo: { on: true, waveform: 'sine', rate: 6, depth: 0.1, target: 'pitch' }, // Vibrato
  },

  // --- Bass ---
  {
    name: 'Rumble Bass',
    adsr: { attack: 0.02, decay: 0.2, sustain: 0.8, release: 0.3 },
    osc1: { waveform: 'square', detune: -3, octave: -1 },
    osc2: { waveform: 'square', detune: 3, octave: -2 },
    mix: 0.5,
    filter: { on: true, type: 'lowpass', cutoff: 600, resonance: 2.5 },
    saturation: { on: true, mix: 0.6, drive: 0.5 },
  },
  {
    name: 'Pluck Bass',
    adsr: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.2 },
    osc1: { waveform: 'square', detune: 0, octave: -1 },
    osc2: { waveform: 'square', detune: 0, octave: -1 },
    mix: 0,
    singleOscillator: true,
    filter: { on: true, type: 'lowpass', cutoff: 1200, resonance: 2 },
  },
  {
    name: 'Detuned Bass',
    adsr: { attack: 0.03, decay: 0.4, sustain: 0.2, release: 0.25 },
    osc1: { waveform: 'sawtooth', detune: -8, octave: -1 },
    osc2: { waveform: 'sawtooth', detune: 8, octave: -1 },
    mix: 0.5,
    filter: { on: true, type: 'lowpass', cutoff: 800, resonance: 3 },
    saturation: { on: true, mix: 0.4, drive: 0.2 },
  },
];
