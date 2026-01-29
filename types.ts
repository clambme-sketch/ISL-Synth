





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

export interface SampleSettings {
    trimStart: number; // 0.0 to 1.0
    trimEnd: number; // 0.0 to 1.0
    loop: boolean;
}

export type LFOTarget = 'pitch' | 'filter' | 'amplitude';

export interface LFOSettings {
  on: boolean;
  waveform: WaveformType;
  rate: number; // in Hz (or Ratio if keySync is true)
  depth: number; // 0 to 1
  target: LFOTarget;
  retrigger: boolean;
  keySync?: boolean; // If true, rate is a ratio relative to note frequency (FM)
}

// --- ARPEGGIATOR ---
export type ArpDirection = 'up' | 'down' | 'upDown' | 'random' | 'played';
export type ArpRate = '1/4' | '1/8' | '1/16' | '1/32';

export interface ArpeggiatorSettings {
    on: boolean;
    latch: boolean;
    rate: ArpRate;
    direction: ArpDirection;
    range: number; // 1 to 3 octaves
    gate: number; // 0.1 to 1.0 (note length relative to step)
}

export type PresetCategory = 'Simple' | 'Subtractive' | 'AM' | 'FM' | '808' | 'Sampling';

export interface SynthPreset {
  name: string;
  category: PresetCategory;
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
    sampleVolume?: number;
    warpRatio?: number; // Added for Sample Warping support
    // Full effects chain settings for export
    filter: FilterSettings;
    reverb: ReverbSettings;
    delay: DelaySettings;
    saturation: SaturationSettings;
    chorus: ChorusSettings;
    phaser: PhaserSettings;
    lfo: LFOSettings;
    activeCategory?: PresetCategory;
    activePresetName?: string;
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

// --- SONG BUILDER ---
export interface SongMeasure {
    id: string;
    chords: (string | null)[]; // Array of chords for the measure (currently supports 2: [beat 1, beat 3])
}

export interface SongPattern {
    id: string;
    name: string;
    sequence: SongMeasure[];
}

export interface ArrangementBlock {
    id: string; // Unique instance ID in timeline
    patternId: string;
}

// --- DRUM MACHINE ---
export type DrumType = 'kick' | 'snare' | 'hihat';

export interface DrumPattern {
    kick: boolean[];
    snare: boolean[];
    hihat: boolean[];
}
