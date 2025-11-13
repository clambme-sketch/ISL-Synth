
export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface ADSREnvelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface OscillatorSettings {
  waveform: WaveformType;
  detune: number; // in cents
  octave: number; // octave offset (-2 to +2)
}

export type LFOTarget = 'pitch' | 'filter' | 'amplitude';

export interface LFOSettings {
  on: boolean;
  waveform: WaveformType;
  rate: number; // in Hz
  depth: number; // 0 to 1
  target: LFOTarget;
}

export interface SynthPreset {
  name: string;
  adsr: ADSREnvelope;
  osc1: OscillatorSettings;
  osc2: OscillatorSettings;
  mix: number; // 0 for Osc1, 1 for Osc2
  singleOscillator?: boolean;
  filter?: FilterSettings;
  reverb?: ReverbSettings;
  delay?: DelaySettings;
  saturation?: SaturationSettings;
  chorus?: ChorusSettings;
  phaser?: PhaserSettings;
  lfo?: LFOSettings;
}

export interface LoopEvent {
  note: string;
  startTime: number;
  duration: number;
}

export interface SynthSettings {
    adsr: ADSREnvelope;
    osc1: OscillatorSettings;
    osc2: OscillatorSettings;
    mix: number;
}

export type ChordMode = 'major' | 'dominant7' | 'minor' | 'diminished' | 'augmented' | 'diatonic';

// --- EFFECTS ---

export interface ReverbSettings {
  on: boolean;
  mix: number; // 0 (dry) to 1 (wet)
  decay: number; // in seconds
}

export interface DelaySettings {
  on: boolean;
  mix: number; // 0 (dry) to 1 (wet)
  time: number; // in seconds
  feedback: number; // 0 to 1
}

export type FilterType = 'lowpass' | 'highpass' | 'bandpass';

export interface FilterSettings {
  on: boolean;
  type: FilterType;
  cutoff: number; // in Hz
  resonance: number; // Q factor
}

export interface SaturationSettings {
  on: boolean;
  mix: number; // 0 (dry) to 1 (wet)
  drive: number; // 0 to 1
}

export interface ChorusSettings {
  on: boolean;
  mix: number; // 0 (dry) to 1 (wet)
  rate: number; // in Hz
  depth: number; // 0 to 1
}

export interface PhaserSettings {
  on: boolean;
  mix: number; // 0 (dry) to 1 (wet)
  rate: number; // in Hz
  depth: number; // 0 to 1
  baseFrequency: number; // in Hz
}