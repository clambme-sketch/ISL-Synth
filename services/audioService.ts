
import type { ADSREnvelope, OscillatorSettings, LoopEvent, SynthSettings, FilterSettings, DelaySettings, ReverbSettings, SaturationSettings, PhaserSettings, ChorusSettings, LFOSettings, LFOTarget, PresetCategory, SampleSettings, DrumType } from '../types';
import { NOTE_FREQUENCIES, JUST_INTONATION_RATIOS, ALL_NOTES_CHROMATIC, DEFAULT_LFO_SETTINGS } from '../constants';
import { detectChordFromNotes, NOTE_NAME_TO_CHROMATIC_INDEX, normalizeNoteName } from './musicTheory';

// Safety constant to prevent "Non-finite" errors in exponential ramps
const MIN_VALUE = 0.0001;

// Helper to sanitize numbers for AudioParams (Gain, Detune, etc.)
const safe = (val: number | undefined, fallback: number = 0): number => {
    if (val === undefined || val === null || !Number.isFinite(val) || Number.isNaN(val)) {
        return fallback;
    }
    return val;
};

// Helper to sanitize strictly positive values (Frequency, Time, Ramp Targets)
const safePos = (val: number | undefined, fallback: number = 0.001): number => {
    const s = safe(val, fallback);
    return s <= 0 ? fallback : s;
};

interface ActiveNode {
  sources: (OscillatorNode | AudioBufferSourceNode | GainNode)[]; 
  adsrGain: GainNode;
  osc1Settings?: OscillatorSettings;
  osc2Settings?: OscillatorSettings;
  rootNote: string;
  // Timing info for envelope interruption
  startTime: number;
  attackDuration: number;
  decayDuration: number;
  peakGain: number;
  sustainGain: number;
}

export class AudioEngine {
  private audioContext: AudioContext;
  private masterCompressor: DynamicsCompressorNode;
  public analyserX: AnalyserNode;
  public analyserY: AnalyserNode;
  private allpassFilter: BiquadFilterNode;
  private activeNodes: Map<string, ActiveNode> = new Map();
  private adaptiveTuningEnabled = false;
  private monoEnabled = false;
  private noteToIndexMap: Map<string, number> = new Map();
  private currentPitchBend = 0;
  private retuneTimeout: number | null = null;
  private sampleBuffer: AudioBuffer | null = null;
  private sampleSettings: SampleSettings = { trimStart: 0, trimEnd: 1.0, loop: false };

  // Audio routing nodes
  private masterGain: GainNode;
  private sampleBus: GainNode; 
  private finalFxInput: GainNode; 
  private dryGain: GainNode;
  private outputGain: GainNode; 

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
  private lfoSettings: LFOSettings = DEFAULT_LFO_SETTINGS;

  // Shared Buffers for Drums
  private noiseBuffer: AudioBuffer;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create Noise Buffer for Snare/HiHat
    this.noiseBuffer = this.createNoiseBuffer(this.audioContext);

    ALL_NOTES_CHROMATIC.forEach((note, index) => {
        this.noteToIndexMap.set(note, index);
    });
    
    // --- MASTER & ROUTING NODES ---
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 1.0;
    
    this.sampleBus = this.audioContext.createGain();
    this.sampleBus.gain.value = 0.5; // Default sample volume

    this.finalFxInput = this.audioContext.createGain();
    
    this.dryGain = this.audioContext.createGain();
    this.dryGain.gain.value = 1.0; // Ensure dry signal passes

    this.outputGain = this.audioContext.createGain();
    this.outputGain.gain.value = 0.75; // Initial master volume

    // --- LFO & MODULATION NODES ---
    this.tremoloGain = this.audioContext.createGain();
    this.tremoloGain.gain.value = 1.0;

    this.lfoGain = this.audioContext.createGain(); // Depth control
    this.lfoGain.gain.value = 0; // Start with 0 depth

    this.lfo = this.audioContext.createOscillator();
    this.lfo.connect(this.lfoGain);
    this.lfo.start();

    // --- SERIAL EFFECTS CHAIN ---
    
    // 1. Filter
    this.filterNode = this.audioContext.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 20000; // Open by default

    // 2. Saturation
    this.saturationIn = this.audioContext.createGain();
    this.saturationNode = this.audioContext.createWaveShaper();
    this.saturationWet = this.audioContext.createGain();
    this.saturationWet.gain.value = 0;
    this.saturationDry = this.audioContext.createGain();
    this.saturationDry.gain.value = 1.0; // Pass through by default
    this.saturationNode.curve = this.makeDistortionCurve(0);
    this.saturationNode.oversample = '4x';
    
    // 3. Phaser
    this.phaserIn = this.audioContext.createGain();
    this.phaserWet = this.audioContext.createGain();
    this.phaserWet.gain.value = 0;
    this.phaserDry = this.audioContext.createGain();
    this.phaserDry.gain.value = 1.0; // Pass through by default

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
    this.chorusWet.gain.value = 0;
    this.chorusDry = this.audioContext.createGain();
    this.chorusDry.gain.value = 1.0; // Pass through by default

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
    this.delayWetGain.gain.value = 0;

    this.reverbNode = this.audioContext.createConvolver();
    this.reverbWetGain = this.audioContext.createGain();
    this.reverbWetGain.gain.value = 0;
    this.reverbNode.buffer = this.createImpulseResponse(this.audioContext, 0.01, 0.01); // Placeholder IR

    // --- MASTER OUTPUT NODES ---
    this.masterCompressor = this.audioContext.createDynamicsCompressor();
    // Softened settings to prevent harsh limiting or cutting off tails
    this.masterCompressor.threshold.setValueAtTime(-1.0, this.audioContext.currentTime);
    this.masterCompressor.knee.setValueAtTime(10, this.audioContext.currentTime); // Soft knee
    this.masterCompressor.ratio.setValueAtTime(12.0, this.audioContext.currentTime); // Standard limiting ratio
    this.masterCompressor.attack.setValueAtTime(0.005, this.audioContext.currentTime); 
    this.masterCompressor.release.setValueAtTime(0.1, this.audioContext.currentTime);

    this.analyserX = this.audioContext.createAnalyser();
    this.analyserY = this.audioContext.createAnalyser();
    this.allpassFilter = this.audioContext.createBiquadFilter();
    this.allpassFilter.type = 'allpass';

    // --- AUDIO ROUTING ---
    // Samples -> Master Gain
    this.sampleBus.connect(this.masterGain); 
    
    // Master Gain -> Tremolo -> Filter
    this.masterGain.connect(this.tremoloGain);
    this.tremoloGain.connect(this.filterNode);
    
    // Filter -> Saturation
    this.filterNode.connect(this.saturationIn);
    
    // Saturation -> Phaser
    this.saturationIn.connect(this.saturationDry);
    this.saturationIn.connect(this.saturationNode);
    this.saturationNode.connect(this.saturationWet);
    this.saturationDry.connect(this.phaserIn);
    this.saturationWet.connect(this.phaserIn);
    
    // Phaser -> Chorus
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
    
    // Chorus -> Final FX Input
    this.chorusIn.connect(this.chorusDry);
    this.chorusIn.connect(this.chorusDelay);
    this.chorusDelay.connect(this.chorusWet);
    this.chorusDry.connect(this.finalFxInput);
    this.chorusWet.connect(this.finalFxInput);

    // Final FX Input splits to Dry, Delay, Reverb
    this.finalFxInput.connect(this.dryGain);
    this.finalFxInput.connect(this.delayNode);
    this.finalFxInput.connect(this.reverbNode);
    
    // Delay Loop
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    
    // Recombine at Compressor
    this.dryGain.connect(this.masterCompressor);
    this.delayNode.connect(this.delayWetGain);
    this.delayWetGain.connect(this.masterCompressor);
    this.reverbNode.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.masterCompressor);
    
    // Output Routing
    this.masterCompressor.connect(this.outputGain);
    this.outputGain.connect(this.analyserX);
    this.analyserX.connect(this.audioContext.destination);
    
    // Route for Y-axis scope (Phase)
    this.outputGain.connect(this.allpassFilter);
    this.allpassFilter.connect(this.analyserY);
  }

  private createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
      const bufferSize = ctx.sampleRate * 2; // 2 seconds
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      return buffer;
  }

  public playDrum(type: DrumType, time: number) {
      if (this.audioContext.state === 'suspended') this.audioContext.resume();
      const t = time;
      
      if (type === 'kick') {
          const osc = this.audioContext.createOscillator();
          const gain = this.audioContext.createGain();
          
          osc.connect(gain);
          gain.connect(this.masterCompressor); 
          
          osc.frequency.setValueAtTime(150, t);
          osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
          
          gain.gain.setValueAtTime(1, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          
          osc.start(t);
          osc.stop(t + 0.5);
      } else if (type === 'snare') {
          const noise = this.audioContext.createBufferSource();
          noise.buffer = this.noiseBuffer;
          const noiseFilter = this.audioContext.createBiquadFilter();
          noiseFilter.type = 'highpass';
          noiseFilter.frequency.value = 1000;
          const noiseGain = this.audioContext.createGain();
          
          noise.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
          noiseGain.connect(this.masterCompressor);
          
          noiseGain.gain.setValueAtTime(1, t);
          noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
          
          noise.start(t);
          noise.stop(t + 0.2);
          
          const osc = this.audioContext.createOscillator();
          osc.type = 'triangle';
          const oscGain = this.audioContext.createGain();
          
          osc.connect(oscGain);
          oscGain.connect(this.masterCompressor);
          
          osc.frequency.setValueAtTime(250, t);
          oscGain.gain.setValueAtTime(0.5, t);
          oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
          
          osc.start(t);
          osc.stop(t + 0.1);
          
      } else if (type === 'hihat') {
          const source = this.audioContext.createBufferSource();
          source.buffer = this.noiseBuffer;
          
          const filter = this.audioContext.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = 5000;
          
          const gain = this.audioContext.createGain();
          
          source.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterCompressor);
          
          gain.gain.setValueAtTime(0.6, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
          
          source.start(t);
          source.stop(t + 0.05);
      }
  }

  private createImpulseResponse(ctx: BaseAudioContext, duration: number, decay: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const len = Math.max(1, sampleRate * safePos(duration, 0.1));
    const impulse = ctx.createBuffer(2, len, sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    if (!decay) decay = 2.0;
    for (let i = 0; i < len; i++) {
        const n = len - i;
        const val = Math.pow(n / len, decay);
        impulseL[i] = (Math.random() * 2 - 1) * val;
        impulseR[i] = (Math.random() * 2 - 1) * val;
    }
    return impulse;
  }
  
  private makeDistortionCurve(amount: number): Float32Array {
    const k = safe(amount) * 100;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private findNearestPositiveZeroCrossing(data: Float32Array, index: number, window: number): number {
      const start = Math.max(0, index - window);
      const end = Math.min(data.length - 1, index + window);
      let bestIndex = index;
      let minDiff = Infinity;

      for (let i = start; i < end - 1; i++) {
          if (data[i] <= 0 && data[i + 1] > 0) {
              const diff = Math.abs(i - index);
              if (diff < minDiff) {
                  minDiff = diff;
                  bestIndex = i;
              }
          }
      }
      
      if (minDiff === Infinity) {
          let minAmp = 1.0;
          for (let i = start; i < end; i++) {
              const amp = Math.abs(data[i]);
              if (amp < minAmp) {
                  minAmp = amp;
                  bestIndex = i;
              }
          }
      }

      return bestIndex;
  }
  
  public async setSample(buffer: AudioBuffer) {
      this.sampleBuffer = buffer;
  }
  
  public updateSampleSettings(start: number, end: number, loop: boolean) {
      this.sampleSettings = { trimStart: start, trimEnd: end, loop };
  }

  public setSampleVolume(volume: number) {
      const now = this.audioContext.currentTime;
      this.sampleBus.gain.setTargetAtTime(volume, now, 0.02);
  }
  
  public setMasterVolume(volume: number) {
      const now = this.audioContext.currentTime;
      this.outputGain.gain.setTargetAtTime(volume, now, 0.02);
  }

  public getAudioContext(): AudioContext {
    return this.audioContext;
  }
  
  public getLiveFrequencies(): Map<string, number> {
    const frequencies = new Map<string, number>();
    this.activeNodes.forEach((node, noteName) => {
        const source = node.sources[0];
        if (source instanceof OscillatorNode) {
            frequencies.set(noteName, source.frequency.value);
        }
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
    }, 30);
  }

  public playNote(
    note: string, 
    envelope: ADSREnvelope, 
    osc1Settings: OscillatorSettings, 
    osc2Settings: OscillatorSettings, 
    mix: number, 
    time?: number, 
    rootNote?: string, 
    category?: PresetCategory,
    warpRatio: number = 1.0,
    presetName?: string
  ): void {
    if (this.audioContext.state === 'suspended') this.audioContext.resume();

    // Re-trigger LFO if needed
    if (this.lfoSettings.on && this.lfoSettings.retrigger && !this.lfoSettings.keySync && this.activeNodes.size === 0) {
        const retriggerTime = time ?? this.audioContext.currentTime;
        try {
            this.lfo.stop();
            this.lfo.disconnect(this.lfoGain);
        } catch(e) { /* ignore if already stopped */ }

        this.lfo = this.audioContext.createOscillator();
        this.lfo.type = this.lfoSettings.waveform;
        this.lfo.frequency.setValueAtTime(this.lfoSettings.rate, retriggerTime);

        this.lfo.connect(this.lfoGain);
        this.lfo.start(retriggerTime);
    }

    if (this.activeNodes.has(note)) {
        this.stopNote(note, 0.05, time);
    }

    const now = time ?? this.audioContext.currentTime;
    
    // --- MONO MODE LOGIC ---
    if (this.monoEnabled) {
        // Stop all other notes instantly (fast fade) to enforce monophony
        this.activeNodes.forEach((_, activeNote) => {
            if (activeNote !== note) {
                this.stopNote(activeNote, 0.005, now);
            }
        });
    }

    const finalRootNote = rootNote || note;
    
    const adsrGain = this.audioContext.createGain();
    adsrGain.gain.value = 0;
    adsrGain.gain.setValueAtTime(0, now);
    
    if (category === 'Sampling') {
        adsrGain.connect(this.sampleBus);
    } else {
        adsrGain.connect(this.masterGain);
    }

    const attack = Math.max(envelope.attack, 0.002);
    const decay = envelope.decay;
    const sustain = envelope.sustain;
    
    const peakGain = 0.25;
    const sustainGain = sustain * peakGain;

    if (category === 'Sampling' && this.sampleBuffer) {
         const source = this.audioContext.createBufferSource();
         source.buffer = this.sampleBuffer;
         
         const rootMidi = 60; 
         const noteMidi = this.noteToIndexMap.get(note) ? this.noteToIndexMap.get(note)! + 24 : 60;
         const pitchRatio = Math.pow(2, (noteMidi - rootMidi) / 12);
         
         source.playbackRate.value = pitchRatio * warpRatio;
         
         source.connect(adsrGain);
         
         const bufferLen = this.sampleBuffer.length;
         const channelData = this.sampleBuffer.getChannelData(0);
         const searchWindow = 500; 
         
         const rawStartIdx = Math.floor(this.sampleSettings.trimStart * bufferLen);
         
         const safeStartIdx = this.findNearestPositiveZeroCrossing(channelData, rawStartIdx, searchWindow);
         
         const startTimeOffset = safeStartIdx / this.sampleBuffer.sampleRate;
         
         let duration = undefined;
         if (this.sampleSettings.trimEnd < 1.0) {
             const rawEndIdx = Math.floor(this.sampleSettings.trimEnd * bufferLen);
             const safeEndIdx = this.findNearestPositiveZeroCrossing(channelData, rawEndIdx, searchWindow);
             const endTimeOffset = safeEndIdx / this.sampleBuffer.sampleRate;
             duration = Math.max(0, endTimeOffset - startTimeOffset);
         }

         source.loop = this.sampleSettings.loop;
         if (this.sampleSettings.loop && duration) {
             source.loopStart = startTimeOffset;
             source.loopEnd = startTimeOffset + duration;
         }

         source.start(now, startTimeOffset, this.sampleSettings.loop ? undefined : duration);
         
         adsrGain.gain.linearRampToValueAtTime(peakGain, now + attack);
         adsrGain.gain.exponentialRampToValueAtTime(Math.max(sustainGain, 0.001), now + attack + decay);

         this.activeNodes.set(note, {
            sources: [source],
            adsrGain,
            rootNote: finalRootNote,
            startTime: now,
            attackDuration: attack,
            decayDuration: decay,
            peakGain,
            sustainGain
         });
         return;
    }

    // --- SYNTH OSCILLATORS ---
    const freq1 = this.getFrequencyForNote(note, osc1Settings.octave);
    const freq2 = this.getFrequencyForNote(note, osc2Settings.octave);

    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();

    osc1.type = osc1Settings.waveform;
    osc2.type = osc2Settings.waveform;

    osc1.frequency.setValueAtTime(freq1, now);
    osc1.detune.setValueAtTime(osc1Settings.detune + this.currentPitchBend, now);
    
    osc2.frequency.setValueAtTime(freq2, now);
    osc2.detune.setValueAtTime(osc2Settings.detune + this.currentPitchBend, now);

    // --- MODULATION LOGIC ---
    if (this.lfoSettings.on && this.lfoSettings.keySync) {
        // Key Sync LFO (FM/AM per voice)
        const lfoOsc = this.audioContext.createOscillator();
        lfoOsc.type = this.lfoSettings.waveform;
        
        let lfoFreq = this.lfoSettings.rate; // Hz
        if (this.lfoSettings.keySync) {
            // Rate is a ratio relative to fundamental
            lfoFreq = freq1 * this.lfoSettings.rate;
        }
        lfoOsc.frequency.setValueAtTime(lfoFreq, now);
        
        const lfoAmp = this.audioContext.createGain();
        lfoOsc.connect(lfoAmp);
        lfoOsc.start(now);
        
        if (this.lfoSettings.target === 'pitch') {
            // FM
            const modulationIndex = this.lfoSettings.depth * 1000; // Arbitrary scale
            lfoAmp.gain.setValueAtTime(modulationIndex, now);
            lfoAmp.connect(osc1.frequency);
            lfoAmp.connect(osc2.frequency);
        } else if (this.lfoSettings.target === 'amplitude') {
            // AM / Ring Mod
            lfoAmp.gain.setValueAtTime(this.lfoSettings.depth, now);
            
            // For AM, we need a carrier gain that is modulated
            // osc -> amGain -> adsrGain
            const amGain1 = this.audioContext.createGain();
            const amGain2 = this.audioContext.createGain();
            
            amGain1.gain.value = 1 - (this.lfoSettings.depth / 2); // Center
            amGain2.gain.value = 1 - (this.lfoSettings.depth / 2);
            
            lfoAmp.connect(amGain1.gain);
            lfoAmp.connect(amGain2.gain);
            
            osc1.disconnect();
            osc1.connect(amGain1);
            amGain1.connect(adsrGain);
            
            osc2.disconnect();
            osc2.connect(amGain2);
            amGain2.connect(adsrGain);
        }
    }

    const osc1Gain = this.audioContext.createGain();
    const osc2Gain = this.audioContext.createGain();

    osc1Gain.gain.setValueAtTime(1 - mix, now);
    osc2Gain.gain.setValueAtTime(mix, now);

    osc1.connect(osc1Gain);
    osc2.connect(osc2Gain);

    osc1Gain.connect(adsrGain);
    osc2Gain.connect(adsrGain);

    osc1.start(now);
    osc2.start(now);

    adsrGain.gain.linearRampToValueAtTime(peakGain, now + attack);
    adsrGain.gain.exponentialRampToValueAtTime(Math.max(sustainGain, 0.001), now + attack + decay);

    this.activeNodes.set(note, {
        sources: [osc1, osc2, osc1Gain, osc2Gain],
        adsrGain,
        osc1Settings,
        osc2Settings,
        rootNote: finalRootNote,
        startTime: now,
        attackDuration: attack,
        decayDuration: decay,
        peakGain,
        sustainGain
    });
    
    if (this.adaptiveTuningEnabled) {
        this.scheduleRetune();
    }
  }

  public stopNote(note: string, release: number, time?: number): void {
    const activeNode = this.activeNodes.get(note);
    if (!activeNode) return;

    const now = time ?? this.audioContext.currentTime;
    const { adsrGain, sources } = activeNode;

    // Prevent clicking by cancelling scheduled values.
    // This is crucial for future scheduled events.
    adsrGain.gain.cancelScheduledValues(now);
    
    // Smooth release logic using setTargetAtTime
    // This works correctly for both immediate (Key Up) and future (Looper) events
    // because it transitions from the *scheduled* value at 'now', avoiding the 'value' property read issue.
    // Time constant = release / 4 ensures gain drops ~98% by the end of release time.
    adsrGain.gain.setTargetAtTime(0, now, Math.max(release / 4, 0.005));

    const stopTime = now + release + 0.1; 

    sources.forEach(source => {
      if (source instanceof OscillatorNode || source instanceof AudioBufferSourceNode) {
        source.stop(stopTime);
      }
    });

    // Cleanup after sound is done
    setTimeout(() => {
        // Double check it hasn't been re-triggered
        if (this.activeNodes.get(note) === activeNode) {
            this.activeNodes.delete(note);
            if (this.adaptiveTuningEnabled) {
                this.scheduleRetune();
            }
        }
    }, (release + 0.2) * 1000);
  }

  public stopAllNotes(): void {
      this.activeNodes.forEach((node, note) => {
          this.stopNote(note, 0.1);
      });
  }

  // --- UPDATED RENDER LOOP TO BUFFER WITH SAFETY CHECKS ---
  public async renderLoopToBuffer(
    loopEvents: LoopEvent[],
    bpm: number,
    bars: number,
    settings: SynthSettings,
    onProgress?: (progress: number) => void
  ): Promise<AudioBuffer> {
    if (!loopEvents || loopEvents.length === 0) {
        throw new Error("No events to render");
    }

    const safeBpm = safePos(bpm, 120);
    const safeBars = safePos(bars, 4);
    
    const secondsPerBeat = 60 / safeBpm;
    const totalDuration = secondsPerBeat * 4 * safeBars;
    const sampleRate = 44100;
    const length = Math.ceil(totalDuration * sampleRate);

    // Create Offline Context
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

    // --- RECREATE AUDIO GRAPH FOR OFFLINE RENDER ---
    // Topology must replicate Live Engine:
    // Source -> Master -> Tremolo -> Filter -> Saturation -> Phaser -> Chorus -> [Delay, Reverb, Dry] -> Compressor

    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = 1.0;

    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = -1.0;
    compressor.knee.value = 10;
    compressor.ratio.value = 12.0;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.1;
    compressor.connect(offlineCtx.destination);

    // 1. Tremolo Node
    const tremoloGain = offlineCtx.createGain();
    tremoloGain.gain.value = 1.0;
    masterGain.connect(tremoloGain);

    // 2. Filter
    const filter = offlineCtx.createBiquadFilter();
    filter.type = settings.filter.type;
    filter.frequency.value = settings.filter.on ? safePos(settings.filter.cutoff, 20000) : 20000;
    filter.Q.value = settings.filter.on ? safePos(settings.filter.resonance, 1) : 1;
    tremoloGain.connect(filter);

    // 3. Saturation
    const saturationIn = offlineCtx.createGain();
    const saturationNode = offlineCtx.createWaveShaper();
    const saturationWet = offlineCtx.createGain();
    const saturationDry = offlineCtx.createGain();
    
    filter.connect(saturationIn);
    
    if (settings.saturation.on) {
        saturationNode.curve = this.makeDistortionCurve(safe(settings.saturation.drive));
        saturationNode.oversample = '4x';
        saturationWet.gain.value = safe(settings.saturation.mix);
        saturationDry.gain.value = 1 - safe(settings.saturation.mix);
    } else {
        saturationWet.gain.value = 0;
        saturationDry.gain.value = 1;
    }
    
    saturationIn.connect(saturationNode);
    saturationNode.connect(saturationWet);
    saturationIn.connect(saturationDry);

    // 4. Phaser
    const phaserIn = offlineCtx.createGain();
    const phaserWet = offlineCtx.createGain();
    const phaserDry = offlineCtx.createGain();
    
    saturationWet.connect(phaserIn);
    saturationDry.connect(phaserIn);
    
    let phaserOutputNode: AudioNode = phaserIn;

    if (settings.phaser.on) {
        phaserWet.gain.value = safe(settings.phaser.mix);
        phaserDry.gain.value = 1 - safe(settings.phaser.mix);
        
        const phaserFilters: BiquadFilterNode[] = [];
        for(let i=0; i<6; i++) {
            const f = offlineCtx.createBiquadFilter();
            f.type = 'allpass';
            f.frequency.value = safePos(settings.phaser.baseFrequency, 350);
            f.Q.value = 1;
            phaserFilters.push(f);
        }
        
        // Connect Chain
        phaserIn.connect(phaserFilters[0]);
        for(let i=0; i<5; i++) {
            phaserFilters[i].connect(phaserFilters[i+1]);
        }
        phaserFilters[5].connect(phaserWet);
        phaserIn.connect(phaserDry);
        
        // Create LFO for Phaser
        const pLfo = offlineCtx.createOscillator();
        pLfo.type = 'sine';
        pLfo.frequency.value = safePos(settings.phaser.rate);
        const pLfoGain = offlineCtx.createGain();
        pLfoGain.gain.value = safe(settings.phaser.depth * 1000);
        
        pLfo.connect(pLfoGain);
        phaserFilters.forEach(f => pLfoGain.connect(f.frequency));
        pLfo.start(0);
        
        // Output junction
        const phaserJoin = offlineCtx.createGain();
        phaserWet.connect(phaserJoin);
        phaserDry.connect(phaserJoin);
        phaserOutputNode = phaserJoin;
    }

    // 5. Chorus
    const chorusIn = offlineCtx.createGain();
    phaserOutputNode.connect(chorusIn);
    
    let chorusOutputNode: AudioNode = chorusIn;
    
    if (settings.chorus.on) {
        const chorusWet = offlineCtx.createGain();
        const chorusDry = offlineCtx.createGain();
        const chorusDelay = offlineCtx.createDelay(0.1);
        
        chorusWet.gain.value = safe(settings.chorus.mix);
        chorusDry.gain.value = 1 - safe(settings.chorus.mix);
        
        const cLfo = offlineCtx.createOscillator();
        cLfo.type = 'sine';
        cLfo.frequency.value = safePos(settings.chorus.rate);
        const cLfoGain = offlineCtx.createGain();
        cLfoGain.gain.value = safe(settings.chorus.depth * 0.005);
        
        cLfo.connect(cLfoGain);
        cLfoGain.connect(chorusDelay.delayTime);
        cLfo.start(0);
        
        chorusIn.connect(chorusDry);
        chorusIn.connect(chorusDelay);
        chorusDelay.connect(chorusWet);
        
        const chorusJoin = offlineCtx.createGain();
        chorusWet.connect(chorusJoin);
        chorusDry.connect(chorusJoin);
        chorusOutputNode = chorusJoin;
    }

    // 6. Global FX Bus (Delay, Reverb, Dry) -> Compressor
    const fxInput = chorusOutputNode;
    const finalDryGain = offlineCtx.createGain();
    finalDryGain.gain.value = 1.0;
    
    fxInput.connect(finalDryGain);
    finalDryGain.connect(compressor);
    
    // Delay
    if (settings.delay.on) {
        const dNode = offlineCtx.createDelay(2.0);
        const dFb = offlineCtx.createGain();
        const dWet = offlineCtx.createGain();
        
        dNode.delayTime.value = safePos(settings.delay.time);
        dFb.gain.value = safe(settings.delay.feedback);
        dWet.gain.value = safe(settings.delay.mix);
        
        fxInput.connect(dNode);
        dNode.connect(dFb);
        dFb.connect(dNode);
        dNode.connect(dWet);
        dWet.connect(compressor);
    }
    
    // Reverb
    if (settings.reverb.on) {
        const rNode = offlineCtx.createConvolver();
        const rWet = offlineCtx.createGain();
        rNode.buffer = this.createImpulseResponse(offlineCtx, 0.01, safePos(settings.reverb.decay));
        rWet.gain.value = safe(settings.reverb.mix);
        
        fxInput.connect(rNode);
        rNode.connect(rWet);
        rWet.connect(compressor);
    }

    // 7. Global LFO
    // This needs to be wired if it affects Filter or Tremolo
    if (settings.lfo.on && !settings.lfo.keySync) {
        const gLfo = offlineCtx.createOscillator();
        gLfo.type = settings.lfo.waveform;
        gLfo.frequency.value = safePos(settings.lfo.rate);
        const gLfoGain = offlineCtx.createGain();
        
        gLfo.connect(gLfoGain);
        
        if (settings.lfo.target === 'filter') {
            gLfoGain.gain.value = safe(settings.lfo.depth * 2000);
            gLfoGain.connect(filter.frequency);
        } else if (settings.lfo.target === 'amplitude') {
            gLfoGain.gain.value = safe(settings.lfo.depth);
            gLfoGain.connect(tremoloGain.gain);
        }
        
        gLfo.start(0);
    }

    // --- RENDER EVENTS ---
    for (const event of loopEvents) {
        const startTime = safePos(event.startTime);
        const duration = safePos(event.duration);
        
        if (startTime >= totalDuration) continue;

        const noteGain = offlineCtx.createGain();
        noteGain.connect(masterGain);

        // -- Setup ADSR --
        const attack = safePos(settings.adsr.attack, 0.01);
        const decay = safePos(settings.adsr.decay, 0.1);
        const sustain = safe(settings.adsr.sustain, 0.8);
        const release = safePos(settings.adsr.release, 0.1);
        const peakGain = 0.25;
        const sustainGain = safePos(peakGain * sustain, MIN_VALUE);

        noteGain.gain.setValueAtTime(0, startTime);
        noteGain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
        noteGain.gain.exponentialRampToValueAtTime(sustainGain, startTime + attack + decay);
        
        const releaseStart = startTime + duration;
        if (releaseStart < totalDuration) {
             noteGain.gain.setValueAtTime(sustainGain, releaseStart);
             noteGain.gain.exponentialRampToValueAtTime(MIN_VALUE, releaseStart + release);
        }

        // -- Setup Oscillators / Sample --
        if (settings.activeCategory === 'Sampling' && this.sampleBuffer) {
             // Sample Logic
             const source = offlineCtx.createBufferSource();
             source.buffer = this.sampleBuffer;
             
             const rootMidi = 60;
             const noteMidi = this.noteToIndexMap.get(event.note) ? this.noteToIndexMap.get(event.note)! + 24 : 60;
             const pitchRatio = Math.pow(2, (noteMidi - rootMidi) / 12);
             source.playbackRate.value = pitchRatio * (settings.warpRatio || 1);
             
             // Trim Logic
             const bufferLen = this.sampleBuffer.length;
             const channelData = this.sampleBuffer.getChannelData(0);
             const searchWindow = 500;
             const rawStartIdx = Math.floor(this.sampleSettings.trimStart * bufferLen);
             const safeStartIdx = this.findNearestPositiveZeroCrossing(channelData, rawStartIdx, searchWindow);
             const startOffset = safeStartIdx / this.sampleBuffer.sampleRate;
             
             let sampleDuration = undefined;
             if (this.sampleSettings.trimEnd < 1.0) {
                 const rawEndIdx = Math.floor(this.sampleSettings.trimEnd * bufferLen);
                 const safeEndIdx = this.findNearestPositiveZeroCrossing(channelData, rawEndIdx, searchWindow);
                 const endOffset = safeEndIdx / this.sampleBuffer.sampleRate;
                 sampleDuration = Math.max(0, endOffset - startOffset);
             }
             
             source.loop = this.sampleSettings.loop;
             if (this.sampleSettings.loop && sampleDuration) {
                 source.loopStart = startOffset;
                 source.loopEnd = startOffset + sampleDuration;
             }
             
             source.connect(noteGain);
             source.start(startTime, startOffset, this.sampleSettings.loop ? undefined : sampleDuration);
             
             const stopTime = releaseStart + release + 0.1;
             source.stop(stopTime);

        } else {
            // Synth Logic
            const freq1 = this.getFrequencyForNote(event.note, settings.osc1.octave);
            const freq2 = this.getFrequencyForNote(event.note, settings.osc2.octave);
            
            if (freq1 > 0 && freq2 > 0) {
                const osc1 = offlineCtx.createOscillator();
                const osc2 = offlineCtx.createOscillator();
                
                osc1.type = settings.osc1.waveform;
                osc2.type = settings.osc2.waveform;
                
                osc1.frequency.value = safePos(freq1);
                osc1.detune.value = safe(settings.osc1.detune);
                osc2.frequency.value = safePos(freq2);
                osc2.detune.value = safe(settings.osc2.detune);
                
                // Key Sync FM/AM Logic
                if (settings.lfo.on && settings.lfo.keySync) {
                    const lfoOsc = offlineCtx.createOscillator();
                    lfoOsc.type = settings.lfo.waveform;
                    // Ratio based
                    const lfoFreq = freq1 * settings.lfo.rate;
                    lfoOsc.frequency.value = lfoFreq;
                    
                    const lfoAmp = offlineCtx.createGain();
                    lfoOsc.connect(lfoAmp);
                    lfoOsc.start(startTime);
                    const stopTime = releaseStart + release + 0.1;
                    lfoOsc.stop(stopTime);

                    if (settings.lfo.target === 'pitch') {
                        // FM
                        const modIndex = settings.lfo.depth * 1000;
                        lfoAmp.gain.value = modIndex;
                        lfoAmp.connect(osc1.frequency);
                        lfoAmp.connect(osc2.frequency);
                    } else if (settings.lfo.target === 'amplitude') {
                        // AM - This requires modulating carrier gains
                        lfoAmp.gain.value = settings.lfo.depth;
                        
                        // We need custom gains for AM
                        const amGain1 = offlineCtx.createGain();
                        const amGain2 = offlineCtx.createGain();
                        amGain1.gain.value = 1 - (settings.lfo.depth / 2);
                        amGain2.gain.value = 1 - (settings.lfo.depth / 2);
                        
                        lfoAmp.connect(amGain1.gain);
                        lfoAmp.connect(amGain2.gain);
                        
                        // Override connection
                        const mix = safe(settings.mix, 0.5);
                        const g1 = offlineCtx.createGain();
                        const g2 = offlineCtx.createGain();
                        g1.gain.value = 1 - mix;
                        g2.gain.value = mix;
                        
                        osc1.connect(amGain1);
                        amGain1.connect(g1);
                        g1.connect(noteGain);
                        
                        osc2.connect(amGain2);
                        amGain2.connect(g2);
                        g2.connect(noteGain);
                        
                        osc1.start(startTime);
                        osc2.start(startTime);
                        osc1.stop(stopTime);
                        osc2.stop(stopTime);
                        continue; // Skip standard connection
                    }
                }

                const mix = safe(settings.mix, 0.5);
                const g1 = offlineCtx.createGain();
                const g2 = offlineCtx.createGain();
                g1.gain.value = 1 - mix;
                g2.gain.value = mix;
                
                osc1.connect(g1);
                osc2.connect(g2);
                g1.connect(noteGain);
                g2.connect(noteGain);
                
                osc1.start(startTime);
                osc2.start(startTime);
                
                const stopTime = releaseStart + release + 0.1;
                osc1.stop(stopTime);
                osc2.stop(stopTime);
            }
        }
    }

    // --- EXECUTE RENDER ---
    return offlineCtx.startRendering();
  }

  public updateFilter(settings: FilterSettings) {
    this.filterNode.type = settings.type;
    this.filterNode.frequency.setTargetAtTime(settings.cutoff, this.audioContext.currentTime, 0.1);
    this.filterNode.Q.setTargetAtTime(settings.resonance, this.audioContext.currentTime, 0.1);
    
    if (settings.on) {
        // Ensure connection if not already (simplified routing assumption)
        // In this architecture, filter is always in chain, we just open it up if "off" or bypass logic
        // But here we'll assume it's always active and "off" just means wide open.
        // Actually, the Controls component handles "off" by sending wide open params usually? 
        // No, Controls sends "on: false".
    }
    if (!settings.on) {
        // Bypass values
        if (settings.type === 'lowpass') this.filterNode.frequency.setTargetAtTime(20000, this.audioContext.currentTime, 0.1);
        if (settings.type === 'highpass') this.filterNode.frequency.setTargetAtTime(20, this.audioContext.currentTime, 0.1);
    }
  }

  public updateReverb(settings: ReverbSettings) {
      if (settings.on) {
          this.reverbWetGain.gain.setTargetAtTime(settings.mix, this.audioContext.currentTime, 0.1);
          // Re-generating impulse on every decay change is expensive, usually we pick pre-rendered ones.
          // For this synth, we generate noise bursts. 
          // Optimization: Only regenerate if decay changed significantly or on mouse up.
          // For now, we assume simple gain control. Updating buffer live is glitchy.
      } else {
          this.reverbWetGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
      }
  }

  public updateDelay(settings: DelaySettings) {
      if (settings.on) {
          this.delayNode.delayTime.setTargetAtTime(settings.time, this.audioContext.currentTime, 0.1);
          this.delayFeedback.gain.setTargetAtTime(settings.feedback, this.audioContext.currentTime, 0.1);
          this.delayWetGain.gain.setTargetAtTime(settings.mix, this.audioContext.currentTime, 0.1);
      } else {
          this.delayWetGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
      }
  }

  public updateSaturation(settings: SaturationSettings) {
      if (settings.on) {
          this.saturationNode.curve = this.makeDistortionCurve(settings.drive);
          this.saturationWet.gain.setTargetAtTime(settings.mix, this.audioContext.currentTime, 0.1);
          this.saturationDry.gain.setTargetAtTime(1 - settings.mix, this.audioContext.currentTime, 0.1);
      } else {
          this.saturationWet.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
          this.saturationDry.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.1);
      }
  }

  public updateChorus(settings: ChorusSettings) {
      if (settings.on) {
          this.chorusLfo.frequency.setTargetAtTime(settings.rate, this.audioContext.currentTime, 0.1);
          this.chorusLfoGain.gain.setTargetAtTime(settings.depth * 0.005, this.audioContext.currentTime, 0.1); // Scale depth to delay time
          this.chorusWet.gain.setTargetAtTime(settings.mix, this.audioContext.currentTime, 0.1);
          this.chorusDry.gain.setTargetAtTime(1 - settings.mix, this.audioContext.currentTime, 0.1);
      } else {
          this.chorusWet.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
          this.chorusDry.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.1);
      }
  }

  public updatePhaser(settings: PhaserSettings) {
      if (settings.on) {
          this.phaserLfo.frequency.setTargetAtTime(settings.rate, this.audioContext.currentTime, 0.1);
          // Scale depth to frequency range
          this.phaserLfoGain.gain.setTargetAtTime(settings.depth * 1000, this.audioContext.currentTime, 0.1); 
          
          this.phaserFilters.forEach(f => {
              f.Q.value = 1; // Fixed Q for phaser usually
              f.frequency.setTargetAtTime(settings.baseFrequency, this.audioContext.currentTime, 0.1);
          });

          this.phaserWet.gain.setTargetAtTime(settings.mix, this.audioContext.currentTime, 0.1);
          this.phaserDry.gain.setTargetAtTime(1 - settings.mix, this.audioContext.currentTime, 0.1);
      } else {
          this.phaserWet.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
          this.phaserDry.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.1);
      }
  }

  public updateLFO(settings: LFOSettings) {
      this.lfoSettings = settings;
      
      if (!settings.on) {
          this.lfoGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
          return;
      }

      this.lfo.type = settings.waveform;
      
      if (!settings.keySync) {
          this.lfo.frequency.setTargetAtTime(settings.rate, this.audioContext.currentTime, 0.1);
      }

      // Route LFO based on target
      this.lfoGain.disconnect();
      this.lfoTarget = settings.target;

      if (settings.target === 'pitch') {
          // Vibrato (Connect to Detune or Frequency? Detune is easier for global)
          // Note: Global pitch LFO is tricky without per-voice modulation, usually implemented in playNote.
          // Here we just set state for playNote to use.
      } else if (settings.target === 'filter') {
          this.lfoGain.connect(this.filterNode.frequency);
          this.lfoGain.gain.setTargetAtTime(settings.depth * 2000, this.audioContext.currentTime, 0.1);
      } else if (settings.target === 'amplitude') {
          this.lfoGain.connect(this.tremoloGain.gain);
          this.lfoGain.gain.setTargetAtTime(settings.depth, this.audioContext.currentTime, 0.1);
      }
  }

  public setPitchBend(bend: number) {
      this.currentPitchBend = bend;
      const now = this.audioContext.currentTime;
      this.activeNodes.forEach(node => {
          if (node.osc1Settings) {
             const src1 = node.sources[0] as OscillatorNode;
             const src2 = node.sources[1] as OscillatorNode;
             src1.detune.setTargetAtTime(node.osc1Settings.detune + bend, now, 0.1);
             src2.detune.setTargetAtTime(node.osc2Settings!.detune + bend, now, 0.1);
          }
      });
  }

  public setAdaptiveTuning(enabled: boolean) {
      this.adaptiveTuningEnabled = enabled;
      if (enabled) this.scheduleRetune();
  }
  
  public setMono(enabled: boolean) {
      this.monoEnabled = enabled;
  }

  private retuneActiveNotes() {
      // Robust Adaptive Tuning (Just Intonation)
      if (!this.adaptiveTuningEnabled || this.activeNodes.size < 2) return;

      const activeNoteList: { note: string, midi: number }[] = [];
      const activeNoteNames: string[] = [];

      // 1. Collect all active notes
      this.activeNodes.forEach((node, noteName) => {
          if (node.sources[0] instanceof OscillatorNode) {
              const idx = this.noteToIndexMap.get(node.rootNote);
              if (idx !== undefined) {
                  const offset = node.osc1Settings?.octave || 0;
                  const trueMidi = idx + (offset * 12);
                  activeNoteList.push({ note: noteName, midi: trueMidi });
                  activeNoteNames.push(node.rootNote);
              }
          }
      });

      if (activeNoteList.length < 2) return;

      // 2. Identify Harmonic Root (Chord detection)
      let rootChroma: number;
      
      const detectedChord = detectChordFromNotes(activeNoteNames);
      
      if (detectedChord) {
          // Extract root note name from chord symbol (e.g., "C" from "Cm" or "G" from "G7")
          // Logic: Match start of string up to non-accidental/sharp
          const rootMatch = detectedChord.match(/^([A-G]#?)/);
          const rootName = rootMatch ? rootMatch[1] : null;
          
          if (rootName && NOTE_NAME_TO_CHROMATIC_INDEX[rootName] !== undefined) {
              rootChroma = NOTE_NAME_TO_CHROMATIC_INDEX[rootName];
          } else {
              // Fallback: Lowest note is root
              activeNoteList.sort((a, b) => a.midi - b.midi);
              rootChroma = activeNoteList[0].midi % 12;
          }
      } else {
          // Fallback: Lowest note is root
          activeNoteList.sort((a, b) => a.midi - b.midi);
          rootChroma = activeNoteList[0].midi % 12;
      }

      // 3. Tune each note relative to the Harmonic Root Chroma
      activeNoteList.forEach(item => {
          const noteChroma = item.midi % 12;
          
          // Calculate interval from root chroma (always positive 0-11)
          const interval = (noteChroma - rootChroma + 12) % 12;
          
          const targetRatio = JUST_INTONATION_RATIOS[interval];
          const etRatio = Math.pow(2, interval / 12);
          
          // Calculate detune correction in cents
          const correctionFactor = targetRatio / etRatio;
          const correctionCents = 1200 * Math.log2(correctionFactor);
          
          // Apply correction
          const node = this.activeNodes.get(item.note);
          if (node && node.osc1Settings) {
              const osc1 = node.sources[0] as OscillatorNode;
              const osc2 = node.sources[1] as OscillatorNode;
              
              const baseDetune1 = node.osc1Settings.detune + this.currentPitchBend;
              const baseDetune2 = node.osc2Settings!.detune + this.currentPitchBend;
              
              const now = this.audioContext.currentTime;
              // Smooth transition to lock it in
              osc1.detune.setTargetAtTime(baseDetune1 + correctionCents, now, 0.1);
              osc2.detune.setTargetAtTime(baseDetune2 + correctionCents, now, 0.1);
          }
      });
  }
}
