
import type { ADSREnvelope, OscillatorSettings, LoopEvent, SynthSettings, FilterSettings, DelaySettings, ReverbSettings, SaturationSettings, PhaserSettings, ChorusSettings, LFOSettings, LFOTarget } from '../types';
import { NOTE_FREQUENCIES, JUST_INTONATION_RATIOS, ALL_NOTES_CHROMATIC } from '../constants';

interface ActiveNode {
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  adsrGain: GainNode;
  osc1Settings: OscillatorSettings;
  osc2Settings: OscillatorSettings;
  rootNote: string;
}

export class AudioEngine {
  private audioContext: AudioContext;
  private masterCompressor: DynamicsCompressorNode;
  public analyserX: AnalyserNode;
  public analyserY: AnalyserNode;
  private allpassFilter: BiquadFilterNode;
  private activeNodes: Map<string, ActiveNode> = new Map();
  private adaptiveTuningEnabled = false;
  private noteToIndexMap: Map<string, number> = new Map();
  private currentPitchBend = 0;
  private retuneTimeout: number | null = null;

  // Audio routing nodes
  private masterGain: GainNode;
  private finalFxInput: GainNode; // Input to parallel delay/reverb
  private dryGain: GainNode;

  // Effects nodes
  private filterNode: BiquadFilterNode;

  // Saturation
  private saturationIn: GainNode;
  private saturationNode: WaveShaperNode;
  private saturationWet: GainNode;
  private saturationDry: GainNode;

  // Phaser
  private phaserIn: GainNode;
  private phaserFilters: BiquadFilterNode[];
  private phaserLfo: OscillatorNode;
  private phaserLfoGain: GainNode;
  private phaserWet: GainNode;
  private phaserDry: GainNode;
  
  // Chorus
  private chorusIn: GainNode;
  private chorusDelay: DelayNode;
  private chorusLfo: OscillatorNode;
  private chorusLfoGain: GainNode;
  private chorusWet: GainNode;
  private chorusDry: GainNode;

  // Delay
  private delayNode: DelayNode;
  private delayFeedback: GainNode;
  private delayWetGain: GainNode;
  
  // Reverb
  private reverbNode: ConvolverNode;
  private reverbWetGain: GainNode;
  
  // LFO nodes
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private tremoloGain: GainNode;
  private lfoTarget: LFOTarget | 'none' = 'none';

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    ALL_NOTES_CHROMATIC.forEach((note, index) => {
        this.noteToIndexMap.set(note, index);
    });
    
    // --- MASTER & ROUTING NODES ---
    this.masterGain = this.audioContext.createGain();
    this.finalFxInput = this.audioContext.createGain();
    this.dryGain = this.audioContext.createGain();

    // --- LFO & MODULATION NODES ---
    this.tremoloGain = this.audioContext.createGain();
    this.lfo = this.audioContext.createOscillator();
    this.lfoGain = this.audioContext.createGain(); // Depth control
    this.lfo.connect(this.lfoGain);
    this.lfo.start();

    // --- SERIAL EFFECTS CHAIN ---
    
    // 1. Filter
    this.filterNode = this.audioContext.createBiquadFilter();

    // 2. Saturation
    this.saturationIn = this.audioContext.createGain();
    this.saturationNode = this.audioContext.createWaveShaper();
    this.saturationWet = this.audioContext.createGain();
    this.saturationDry = this.audioContext.createGain();
    this.saturationNode.curve = this.makeDistortionCurve(0);
    this.saturationNode.oversample = '4x';
    
    // 3. Phaser
    this.phaserIn = this.audioContext.createGain();
    this.phaserWet = this.audioContext.createGain();
    this.phaserDry = this.audioContext.createGain();
    this.phaserFilters = Array(6).fill(0).map(() => {
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'allpass';
        return filter;
    });
    this.phaserLfo = this.audioContext.createOscillator();
    this.phaserLfo.type = 'sine';
    this.phaserLfoGain = this.audioContext.createGain();
    this.phaserLfo.connect(this.phaserLfoGain);
    this.phaserFilters.forEach(f => this.phaserLfoGain.connect(f.frequency));
    this.phaserLfo.start();
    
    // 4. Chorus
    this.chorusIn = this.audioContext.createGain();
    this.chorusWet = this.audioContext.createGain();
    this.chorusDry = this.audioContext.createGain();
    this.chorusDelay = this.audioContext.createDelay(0.1);
    this.chorusLfo = this.audioContext.createOscillator();
    this.chorusLfo.type = 'sine';
    this.chorusLfoGain = this.audioContext.createGain();
    this.chorusLfo.connect(this.chorusLfoGain);
    this.chorusLfoGain.connect(this.chorusDelay.delayTime);
    this.chorusLfo.start();

    // --- PARALLEL EFFECTS (Delay/Reverb) ---
    this.delayNode = this.audioContext.createDelay(2.0); // Max 2s delay
    this.delayFeedback = this.audioContext.createGain();
    this.delayWetGain = this.audioContext.createGain();
    this.reverbNode = this.audioContext.createConvolver();
    this.reverbWetGain = this.audioContext.createGain();
    this.reverbNode.buffer = this.createImpulseResponse(0.01, 0.01); // Placeholder IR

    // --- MASTER OUTPUT NODES ---
    this.masterCompressor = this.audioContext.createDynamicsCompressor();
    // Recalibrated to act as a transparent safety limiter, only catching the loudest peaks.
    this.masterCompressor.threshold.setValueAtTime(-2.0, this.audioContext.currentTime); // Higher threshold to only catch peaks
    this.masterCompressor.knee.setValueAtTime(12, this.audioContext.currentTime);    // Keep a soft knee for transparency
    this.masterCompressor.ratio.setValueAtTime(12.0, this.audioContext.currentTime);   // Strong ratio for limiting
    this.masterCompressor.attack.setValueAtTime(0.003, this.audioContext.currentTime); // Fast attack to prevent clipping
    this.masterCompressor.release.setValueAtTime(0.25, this.audioContext.currentTime); // Fairly quick release

    this.analyserX = this.audioContext.createAnalyser();
    this.analyserY = this.audioContext.createAnalyser();
    this.allpassFilter = this.audioContext.createBiquadFilter();
    this.allpassFilter.type = 'allpass';

    // --- AUDIO ROUTING ---
    // Voices -> Master Gain -> Tremolo Gain (for LFO) -> Filter -> ...
    this.masterGain.connect(this.tremoloGain);
    this.tremoloGain.connect(this.filterNode);
    this.filterNode.connect(this.saturationIn);
    
    // Saturation dry/wet path
    this.saturationIn.connect(this.saturationDry);
    this.saturationIn.connect(this.saturationNode);
    this.saturationNode.connect(this.saturationWet);
    this.saturationDry.connect(this.phaserIn);
    this.saturationWet.connect(this.phaserIn);
    
    // Phaser dry/wet path
    this.phaserIn.connect(this.phaserDry);
    this.phaserIn.connect(this.phaserFilters[0]);
    this.phaserFilters.forEach((filter, i) => {
        if (i < this.phaserFilters.length - 1) {
            filter.connect(this.phaserFilters[i + 1]);
        }
    });
    this.phaserFilters[this.phaserFilters.length - 1].connect(this.phaserWet);
    this.phaserDry.connect(this.chorusIn);
    this.phaserWet.connect(this.chorusIn);
    
    // Chorus dry/wet path
    this.chorusIn.connect(this.chorusDry);
    this.chorusIn.connect(this.chorusDelay);
    this.chorusDelay.connect(this.chorusWet);
    this.chorusDry.connect(this.finalFxInput);
    this.chorusWet.connect(this.finalFxInput);

    // Final FX Input splits to parallel delay/reverb and main dry path
    this.finalFxInput.connect(this.dryGain);
    this.finalFxInput.connect(this.delayNode);
    this.finalFxInput.connect(this.reverbNode);
    
    // Delay feedback loop
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    
    // Parallel paths merge at compressor
    this.dryGain.connect(this.masterCompressor);
    this.delayNode.connect(this.delayWetGain);
    this.delayWetGain.connect(this.masterCompressor);
    this.reverbNode.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.masterCompressor);
    
    // Compressor -> Analysers -> Destination
    this.masterCompressor.connect(this.analyserX);
    this.analyserX.connect(this.audioContext.destination);
    this.masterCompressor.connect(this.allpassFilter);
    this.allpassFilter.connect(this.analyserY);
  }

  private createImpulseResponse(duration: number, decay: number): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    if (!decay) decay = 2.0;
    for (let i = 0; i < length; i++) {
        const n = length - i;
        impulseL[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
        impulseR[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
    }
    return impulse;
  }
  
  private makeDistortionCurve(amount: number): Float32Array {
    const k = amount * 100;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public getAudioContext(): AudioContext {
    return this.audioContext;
  }
  
  public getLiveFrequencies(): Map<string, number> {
    const frequencies = new Map<string, number>();
    this.activeNodes.forEach((node, noteName) => {
        // We can just get the frequency of the first oscillator,
        // as they should be tuned relative to each other.
        frequencies.set(noteName, node.osc1.frequency.value);
    });
    return frequencies;
  }

  private getFrequencyForNote(note: string, octaveOffset: number): number {
      const baseFrequency = NOTE_FREQUENCIES[note];
      if (!baseFrequency) return 0;
      return baseFrequency * Math.pow(2, octaveOffset);
  }
  
  private scheduleRetune(): void {
    if (this.retuneTimeout) {
      clearTimeout(this.retuneTimeout);
    }
    this.retuneTimeout = window.setTimeout(() => {
      this.retuneActiveNotes();
    }, 5);
  }

  public playNote( note: string, envelope: ADSREnvelope, osc1Settings: OscillatorSettings, osc2Settings: OscillatorSettings, mix: number, time?: number, rootNote?: string ): void {
    if (this.audioContext.state === 'suspended') this.audioContext.resume();
    if (this.activeNodes.has(note)) this.stopNote(note, 0.01); 

    const freq1 = this.getFrequencyForNote(note, osc1Settings.octave);
    const freq2 = this.getFrequencyForNote(note, osc2Settings.octave);
    if (!freq1 || !freq2) return;

    const now = time ?? this.audioContext.currentTime;
    const finalRootNote = rootNote || note;

    const osc1 = this.audioContext.createOscillator();
    osc1.type = osc1Settings.waveform;
    osc1.frequency.setValueAtTime(freq1, now);
    osc1.detune.setValueAtTime(this.currentPitchBend + osc1Settings.detune, now);

    const osc2 = this.audioContext.createOscillator();
    osc2.type = osc2Settings.waveform;
    osc2.frequency.setValueAtTime(freq2, now);
    osc2.detune.setValueAtTime(this.currentPitchBend + osc2Settings.detune, now);
    
    if (this.lfoTarget === 'pitch') {
        this.lfoGain.connect(osc1.detune);
        this.lfoGain.connect(osc2.detune);
    }
    
    const mix1Gain = this.audioContext.createGain();
    mix1Gain.gain.value = 1 - mix;
    const mix2Gain = this.audioContext.createGain();
    mix2Gain.gain.value = mix;

    const adsrGain = this.audioContext.createGain();
    adsrGain.gain.setValueAtTime(0, now);

    osc1.connect(mix1Gain);
    osc2.connect(mix2Gain);
    mix1Gain.connect(adsrGain);
    mix2Gain.connect(adsrGain);
    adsrGain.connect(this.masterGain);

    const { attack, decay, sustain } = envelope;
    const peakGain = 0.25; // Reduced from 0.5 to provide more headroom for polyphony
    adsrGain.gain.linearRampToValueAtTime(peakGain, now + attack);
    adsrGain.gain.linearRampToValueAtTime(sustain * peakGain, now + attack + decay);
    
    osc1.start(now);
    osc2.start(now);

    this.activeNodes.set(note, { osc1, osc2, adsrGain, osc1Settings, osc2Settings, rootNote: finalRootNote });
    this.scheduleRetune();
  }

  public stopNote(note: string, release: number, time?: number): void {
    const activeNode = this.activeNodes.get(note);
    if (!activeNode) return;

    const { osc1, osc2, adsrGain } = activeNode;
    const now = time ?? this.audioContext.currentTime;

    adsrGain.gain.cancelScheduledValues(now);
    const currentGain = adsrGain.gain.value;
    if (!time) adsrGain.gain.setValueAtTime(currentGain, now);
    const timeConstant = release > 0.001 ? release / 4 : 0.001;
    adsrGain.gain.setTargetAtTime(0, now, timeConstant);

    const stopTime = now + release + 0.05;
    osc1.stop(stopTime);
    osc2.stop(stopTime);

    const cleanupTimeout = (stopTime - this.audioContext.currentTime) * 1000;
    setTimeout(() => {
      if (this.activeNodes.get(note) === activeNode) {
        this.activeNodes.delete(note);
        this.scheduleRetune();
      }
    }, Math.max(0, cleanupTimeout));
  }
  
  public stopAllNotes(release: number = 0.05): void {
    this.activeNodes.forEach((_, note) => this.stopNote(note, release));
  }

  public setPitchBend(cents: number): void {
    this.currentPitchBend = cents;
    const now = this.audioContext.currentTime;
    this.activeNodes.forEach((node) => {
        node.osc1.detune.setTargetAtTime(cents + node.osc1Settings.detune, now, 0.01);
        node.osc2.detune.setTargetAtTime(cents + node.osc2Settings.detune, now, 0.01);
    });
  }
  
  public setAdaptiveTuning(enabled: boolean): void {
    this.adaptiveTuningEnabled = enabled;
    this.resetTuning();
    if (enabled) this.scheduleRetune();
  }
  
  public updateLFO(settings: LFOSettings) {
    const now = this.audioContext.currentTime;

    // First, disconnect from any previous target to prevent conflicts
    if (this.lfoTarget === 'filter') {
        this.lfoGain.disconnect(this.filterNode.frequency);
    } else if (this.lfoTarget === 'amplitude') {
        this.lfoGain.disconnect(this.tremoloGain.gain);
        this.tremoloGain.gain.cancelScheduledValues(now);
        this.tremoloGain.gain.setTargetAtTime(1.0, now, 0.01); // Return to normal volume
    } else if (this.lfoTarget === 'pitch') {
        this.activeNodes.forEach(node => {
            try { this.lfoGain.disconnect(node.osc1.detune); } catch (e) {}
            try { this.lfoGain.disconnect(node.osc2.detune); } catch (e) {}
        });
    }

    this.lfoTarget = 'none';

    if (!settings.on) {
        return; // LFO is off, so we're done
    }

    // Set LFO parameters
    this.lfo.type = settings.waveform;
    this.lfo.frequency.setTargetAtTime(settings.rate, now, 0.02);
    this.lfoTarget = settings.target;

    // Connect to the new target with appropriate depth scaling
    switch (settings.target) {
        case 'filter':
            // Modulate frequency by up to 2 octaves (depth * 2400 cents)
            this.lfoGain.gain.setTargetAtTime(settings.depth * 2400, now, 0.02);
            this.lfoGain.connect(this.filterNode.frequency);
            break;
        case 'amplitude':
            // LFO is bipolar [-1, 1]. Gain param is audiorate.
            // tremoloGain base is 1. We connect LFO to it, so gain becomes 1 + [-depth, +depth].
            // To prevent clipping and silence, the depth value in the UI should be kept < 1.
            this.lfoGain.gain.setTargetAtTime(settings.depth, now, 0.02);
            this.tremoloGain.gain.setValueAtTime(1.0, now); // Ensure baseline is 1
            this.lfoGain.connect(this.tremoloGain.gain);
            break;
        case 'pitch':
            // Modulate detune by up to 1 semitone (depth * 100 cents)
            this.lfoGain.gain.setTargetAtTime(settings.depth * 100, now, 0.02);
            this.activeNodes.forEach(node => {
                this.lfoGain.connect(node.osc1.detune);
                this.lfoGain.connect(node.osc2.detune);
            });
            break;
    }
  }

  public updateFilter(settings: FilterSettings) {
    const now = this.audioContext.currentTime;
    if (!settings.on) {
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.setTargetAtTime(20000, now, 0.01);
        this.filterNode.Q.setTargetAtTime(0, now, 0.01);
    } else {
        this.filterNode.type = settings.type;
        this.filterNode.frequency.setTargetAtTime(settings.cutoff, now, 0.01);
        this.filterNode.Q.setTargetAtTime(settings.resonance, now, 0.01);
    }
  }
  
  public updateSaturation(settings: SaturationSettings) {
    const now = this.audioContext.currentTime;
    if (!settings.on) {
        this.saturationDry.gain.setTargetAtTime(1, now, 0.01);
        this.saturationWet.gain.setTargetAtTime(0, now, 0.01);
    } else {
        this.saturationNode.curve = this.makeDistortionCurve(settings.drive);
        this.saturationDry.gain.setTargetAtTime(1 - settings.mix, now, 0.01);
        this.saturationWet.gain.setTargetAtTime(settings.mix, now, 0.01);
    }
  }

  public updatePhaser(settings: PhaserSettings) {
    const now = this.audioContext.currentTime;
    if (!settings.on) {
        this.phaserDry.gain.setTargetAtTime(1, now, 0.01);
        this.phaserWet.gain.setTargetAtTime(0, now, 0.01);
    } else {
        this.phaserDry.gain.setTargetAtTime(1 - settings.mix, now, 0.01);
        this.phaserWet.gain.setTargetAtTime(settings.mix, now, 0.01);
        this.phaserLfo.frequency.setTargetAtTime(settings.rate, now, 0.01);
        this.phaserLfoGain.gain.setTargetAtTime(settings.depth * (settings.baseFrequency * 0.8), now, 0.01);
        this.phaserFilters.forEach(f => f.frequency.setTargetAtTime(settings.baseFrequency, now, 0.01));
    }
  }

  public updateChorus(settings: ChorusSettings) {
    const now = this.audioContext.currentTime;
    if (!settings.on) {
        this.chorusDry.gain.setTargetAtTime(1, now, 0.01);
        this.chorusWet.gain.setTargetAtTime(0, now, 0.01);
    } else {
        this.chorusDry.gain.setTargetAtTime(1 - settings.mix, now, 0.01);
        this.chorusWet.gain.setTargetAtTime(settings.mix, now, 0.01);
        this.chorusDelay.delayTime.setTargetAtTime(0.02, now, 0.01); // base delay
        this.chorusLfo.frequency.setTargetAtTime(settings.rate, now, 0.01);
        this.chorusLfoGain.gain.setTargetAtTime(settings.depth * 0.01, now, 0.01); // depth in ms
    }
  }

  public updateDelay(settings: DelaySettings) {
    const now = this.audioContext.currentTime;
    this.delayNode.delayTime.setTargetAtTime(settings.time, now, 0.02);
    this.delayFeedback.gain.setTargetAtTime(settings.feedback, now, 0.02);
    this.delayWetGain.gain.setTargetAtTime(settings.on ? settings.mix : 0, now, 0.02);
  }

  public updateReverb(settings: ReverbSettings) {
    const now = this.audioContext.currentTime;
    if (settings.on) {
        const currentDuration = this.reverbNode.buffer?.duration ?? 0;
        if (Math.abs(currentDuration - settings.decay) > 0.05) {
             this.reverbNode.buffer = this.createImpulseResponse(settings.decay, settings.decay);
        }
    }
    this.reverbWetGain.gain.setTargetAtTime(settings.on ? settings.mix : 0, now, 0.02);
  }

  private resetTuning(): void {
    const now = this.audioContext.currentTime;
    this.activeNodes.forEach((node, noteName) => {
        const standardFreq1 = this.getFrequencyForNote(noteName, node.osc1Settings.octave);
        const standardFreq2 = this.getFrequencyForNote(noteName, node.osc2Settings.octave);
        node.osc1.frequency.setTargetAtTime(standardFreq1, now, 0.003);
        node.osc2.frequency.setTargetAtTime(standardFreq2, now, 0.003);
    });
  }
  
  private tuneNote(noteName: string, rootFrequency: number, rootIndex: number, now: number): void {
    const node = this.activeNodes.get(noteName);
    if (!node) return;

    const noteIndex = this.noteToIndexMap.get(noteName) ?? 0;
    const interval = noteIndex - rootIndex;
    const semitonesInOctave = interval % 12;
    const octaveOffset = Math.floor(interval / 12);

    const ratio = JUST_INTONATION_RATIOS[semitonesInOctave < 0 ? semitonesInOctave + 12 : semitonesInOctave];
    const targetFrequency = rootFrequency * ratio * Math.pow(2, octaveOffset);

    const targetFreq1 = targetFrequency * Math.pow(2, node.osc1Settings.octave);
    const targetFreq2 = targetFrequency * Math.pow(2, node.osc2Settings.octave);

    node.osc1.frequency.setTargetAtTime(targetFreq1, now, 0.003);
    node.osc2.frequency.setTargetAtTime(targetFreq2, now, 0.003);
  }

  private retuneActiveNotes(): void {
    if (!this.adaptiveTuningEnabled || this.activeNodes.size === 0) {
        this.resetTuning();
        return;
    }

    const now = this.audioContext.currentTime;
    const noteGroups = new Map<string, string[]>();
    this.activeNodes.forEach((node, noteName) => {
        if (!noteGroups.has(node.rootNote)) {
            noteGroups.set(node.rootNote, []);
        }
        noteGroups.get(node.rootNote)!.push(noteName);
    });

    const chordGroups = new Map<string, string[]>();
    const singleNotes: string[] = [];
    noteGroups.forEach((notes, root) => {
        if (notes.length > 1) {
            chordGroups.set(root, notes);
        } else {
            singleNotes.push(notes[0]);
        }
    });

    chordGroups.forEach((notes, rootNoteName) => {
        const rootFrequency = NOTE_FREQUENCIES[rootNoteName];
        const rootIndex = this.noteToIndexMap.get(rootNoteName) ?? 0;
        if (!rootFrequency) return;
        notes.forEach(noteName => this.tuneNote(noteName, rootFrequency, rootIndex, now));
    });

    if (singleNotes.length > 0) {
        const melodicRootNote = singleNotes.reduce((lowest, current) => 
            (this.noteToIndexMap.get(current) ?? 999) < (this.noteToIndexMap.get(lowest) ?? 999) ? current : lowest
        );
        const melodicRootFrequency = NOTE_FREQUENCIES[melodicRootNote];
        const melodicRootIndex = this.noteToIndexMap.get(melodicRootNote) ?? 0;
        if (!melodicRootFrequency) return;
        singleNotes.forEach(noteName => this.tuneNote(noteName, melodicRootFrequency, melodicRootIndex, now));
    }
  }

  public async renderLoopToBuffer(loop: LoopEvent[], loopDuration: number, settings: SynthSettings): Promise<AudioBuffer> {
    const offlineContext = new OfflineAudioContext(2, this.audioContext.sampleRate * (loopDuration + settings.adsr.release + 0.5), this.audioContext.sampleRate);
    const masterCompressor = offlineContext.createDynamicsCompressor();
    masterCompressor.connect(offlineContext.destination);

    loop.forEach(event => {
        const { note, startTime, duration } = event;
        const { adsr, osc1: osc1Settings, osc2: osc2Settings, mix } = settings;
        const freq1 = this.getFrequencyForNote(note, osc1Settings.octave);
        const freq2 = this.getFrequencyForNote(note, osc2Settings.octave);
        if (!freq1 || !freq2) return;
        
        const osc1 = offlineContext.createOscillator();
        osc1.type = osc1Settings.waveform;
        osc1.frequency.value = freq1;
        osc1.detune.value = osc1Settings.detune;

        const osc2 = offlineContext.createOscillator();
        osc2.type = osc2Settings.waveform;
        osc2.frequency.value = freq2;
        osc2.detune.value = osc2Settings.detune;
        
        const mix1Gain = offlineContext.createGain();
        mix1Gain.gain.value = 1 - mix;
        const mix2Gain = offlineContext.createGain();
        mix2Gain.gain.value = mix;

        const adsrGain = offlineContext.createGain();
        adsrGain.gain.setValueAtTime(0, startTime);
        
        osc1.connect(mix1Gain).connect(adsrGain);
        osc2.connect(mix2Gain).connect(adsrGain);
        adsrGain.connect(masterCompressor);

        const { attack, decay, sustain, release } = adsr;
        const peakGain = 0.25; // Reduced to match live engine and prevent clipping in render
        
        adsrGain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
        adsrGain.gain.linearRampToValueAtTime(sustain * peakGain, startTime + attack + decay);
        
        const noteOffTime = startTime + duration;
        adsrGain.gain.setValueAtTime(sustain * peakGain, noteOffTime);
        adsrGain.gain.linearRampToValueAtTime(0, noteOffTime + release);
        
        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(noteOffTime + release + 0.1);
        osc2.stop(noteOffTime + release + 0.1);
    });

    return offlineContext.startRendering();
  }
}
