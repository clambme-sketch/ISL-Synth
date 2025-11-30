
import type { ADSREnvelope, OscillatorSettings, LoopEvent, SynthSettings, FilterSettings, DelaySettings, ReverbSettings, SaturationSettings, PhaserSettings, ChorusSettings, LFOSettings, LFOTarget, PresetCategory, SampleSettings, DrumType } from '../types';
import { NOTE_FREQUENCIES, JUST_INTONATION_RATIOS, ALL_NOTES_CHROMATIC, DEFAULT_LFO_SETTINGS } from '../constants';

interface ActiveNode {
  sources: (OscillatorNode | AudioBufferSourceNode | GainNode)[]; 
  adsrGain: GainNode;
  osc1Settings?: OscillatorSettings;
  osc2Settings?: OscillatorSettings;
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
  private sampleBuffer: AudioBuffer | null = null;
  private sampleSettings: SampleSettings = { trimStart: 0, trimEnd: 1.0, loop: false };

  // Audio routing nodes
  private masterGain: GainNode;
  private sampleBus: GainNode; // Dedicated bus for samples to control volume
  private finalFxInput: GainNode; // Input to parallel delay/reverb
  private dryGain: GainNode;
  private outputGain: GainNode; // Final master volume control

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
    this.noiseBuffer = this.createNoiseBuffer();

    ALL_NOTES_CHROMATIC.forEach((note, index) => {
        this.noteToIndexMap.set(note, index);
    });
    
    // --- MASTER & ROUTING NODES ---
    this.masterGain = this.audioContext.createGain();
    this.sampleBus = this.audioContext.createGain();
    this.finalFxInput = this.audioContext.createGain();
    this.dryGain = this.audioContext.createGain();
    this.outputGain = this.audioContext.createGain();

    // --- LFO & MODULATION NODES ---
    this.tremoloGain = this.audioContext.createGain();
    this.lfoGain = this.audioContext.createGain(); // Depth control
    this.lfo = this.audioContext.createOscillator();
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
    // Tuned to act more like a limiter for safety against sample volume
    this.masterCompressor.threshold.setValueAtTime(-3.0, this.audioContext.currentTime);
    this.masterCompressor.knee.setValueAtTime(0, this.audioContext.currentTime); // Harder knee for limiting
    this.masterCompressor.ratio.setValueAtTime(20.0, this.audioContext.currentTime); // Higher ratio for limiting
    this.masterCompressor.attack.setValueAtTime(0.001, this.audioContext.currentTime); // Fast attack
    this.masterCompressor.release.setValueAtTime(0.1, this.audioContext.currentTime);

    this.analyserX = this.audioContext.createAnalyser();
    this.analyserY = this.audioContext.createAnalyser();
    this.allpassFilter = this.audioContext.createBiquadFilter();
    this.allpassFilter.type = 'allpass';

    // --- AUDIO ROUTING ---
    this.masterGain.connect(this.tremoloGain);
    this.sampleBus.connect(this.masterGain); // Route samples into master gain
    
    this.tremoloGain.connect(this.filterNode);
    this.filterNode.connect(this.saturationIn);
    
    this.saturationIn.connect(this.saturationDry);
    this.saturationIn.connect(this.saturationNode);
    this.saturationNode.connect(this.saturationWet);
    this.saturationDry.connect(this.phaserIn);
    this.saturationWet.connect(this.phaserIn);
    
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
    
    this.chorusIn.connect(this.chorusDry);
    this.chorusIn.connect(this.chorusDelay);
    this.chorusDelay.connect(this.chorusWet);
    this.chorusDry.connect(this.finalFxInput);
    this.chorusWet.connect(this.finalFxInput);

    this.finalFxInput.connect(this.dryGain);
    this.finalFxInput.connect(this.delayNode);
    this.finalFxInput.connect(this.reverbNode);
    
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    
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

  private createNoiseBuffer(): AudioBuffer {
      const bufferSize = this.audioContext.sampleRate * 2; // 2 seconds
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      return buffer;
  }

  public playDrum(type: DrumType, time: number) {
      const t = time;
      
      if (type === 'kick') {
          const osc = this.audioContext.createOscillator();
          const gain = this.audioContext.createGain();
          
          osc.connect(gain);
          gain.connect(this.masterCompressor); // Bypass synth FX, straight to compressor
          
          osc.frequency.setValueAtTime(150, t);
          osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
          
          gain.gain.setValueAtTime(1, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          
          osc.start(t);
          osc.stop(t + 0.5);
      } else if (type === 'snare') {
          // Noise part
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
          
          // Tonal part (body)
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
          // High hat
          const source = this.audioContext.createBufferSource();
          source.buffer = this.noiseBuffer;
          
          const filter = this.audioContext.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = 5000;
          
          const gain = this.audioContext.createGain();
          
          source.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterCompressor);
          
          // Sharp envelope
          gain.gain.setValueAtTime(0.6, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
          
          source.start(t);
          source.stop(t + 0.05);
      }
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

  // Helper: Finds the nearest positive-going zero crossing to avoid clicks
  private findNearestPositiveZeroCrossing(data: Float32Array, index: number, window: number): number {
      const start = Math.max(0, index - window);
      const end = Math.min(data.length - 1, index + window);
      let bestIndex = index;
      let minDiff = Infinity;

      // Directional search for rising edge crossing: neg -> pos
      for (let i = start; i < end - 1; i++) {
          if (data[i] <= 0 && data[i + 1] > 0) {
              const diff = Math.abs(i - index);
              if (diff < minDiff) {
                  minDiff = diff;
                  bestIndex = i;
              }
          }
      }
      
      // Fallback if no rising edge found: just closest to zero amplitude
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
    }, 30); // Increased to 30ms to catch chords being played slightly arpeggiated
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
    warpRatio: number = 1.0
  ): void {
    if (this.audioContext.state === 'suspended') this.audioContext.resume();

    // Global LFO Retrigger (if not key sync)
    if (this.lfoSettings.on && this.lfoSettings.retrigger && !this.lfoSettings.keySync && this.activeNodes.size === 0) {
        const retriggerTime = time ?? this.audioContext.currentTime;
        this.lfo.stop();
        this.lfo.disconnect(this.lfoGain);

        this.lfo = this.audioContext.createOscillator();
        this.lfo.type = this.lfoSettings.waveform;
        this.lfo.frequency.setValueAtTime(this.lfoSettings.rate, retriggerTime);

        this.lfo.connect(this.lfoGain);
        this.lfo.start(retriggerTime);
    }

    // Softly stop existing note to prevent clicks (voice stealing)
    if (this.activeNodes.has(note)) this.stopNote(note, 0.03, time);

    const now = time ?? this.audioContext.currentTime;
    const finalRootNote = rootNote || note;
    
    const adsrGain = this.audioContext.createGain();
    adsrGain.gain.setValueAtTime(0, now);
    
    // Routing Decision: Samples go to SampleBus, Synths go to MasterGain
    if (category === 'Sampling') {
        adsrGain.connect(this.sampleBus);
    } else {
        adsrGain.connect(this.masterGain);
    }

    // --- SAMPLING MODE ---
    if (category === 'Sampling' && this.sampleBuffer) {
         const source = this.audioContext.createBufferSource();
         source.buffer = this.sampleBuffer;
         
         // Pitch calculation assuming C4 (MIDI 60) is the root of the sample
         const rootMidi = 60; 
         const noteMidi = this.noteToIndexMap.get(note) ? this.noteToIndexMap.get(note)! + 24 : 60;
         const pitchRatio = Math.pow(2, (noteMidi - rootMidi) / 12);
         
         // Apply Warp Ratio (Current BPM / Original BPM)
         // If Warp is 1.0, speed is just determined by pitch.
         // If Warp > 1 (faster BPM), sample plays faster.
         source.playbackRate.value = pitchRatio * warpRatio;
         
         source.connect(adsrGain);
         
         // Zero-Crossing Snap Logic to prevent clicks
         const bufferLen = this.sampleBuffer.length;
         const channelData = this.sampleBuffer.getChannelData(0);
         const searchWindow = 500; // approx 10ms at 44.1k
         
         // Calculate raw indices from 0-1 trim values
         const rawStartIdx = Math.floor(this.sampleSettings.trimStart * bufferLen);
         const rawEndIdx = Math.floor(Math.max(this.sampleSettings.trimEnd, this.sampleSettings.trimStart + 0.001) * bufferLen);
         
         // Find safe zero crossings
         const safeStartIdx = this.findNearestPositiveZeroCrossing(channelData, rawStartIdx, searchWindow);
         const safeEndIdx = this.findNearestPositiveZeroCrossing(channelData, rawEndIdx, searchWindow);
         
         const safeStartTime = safeStartIdx / this.sampleBuffer.sampleRate;
         const safeEndTime = safeEndIdx / this.sampleBuffer.sampleRate;
         
         if (this.sampleSettings.loop) {
             source.loop = true;
             source.loopStart = safeStartTime;
             source.loopEnd = safeEndTime;
             // Start at loopStart to ensure the phase matches the loop return
             source.start(now, safeStartTime);
         } else {
             // For one-shot, we still use safe start, but duration is derived from safe endpoints
             const duration = safeEndTime - safeStartTime;
             // Adjust duration by playback rate so ADSR matches actual sound length
             const adjustedDuration = duration / (pitchRatio * warpRatio);
             
             source.start(now, safeStartTime, duration);
         }
         
         this.activeNodes.set(note, { sources: [source], adsrGain, rootNote: finalRootNote });
    } 
    // --- SYNTH MODE (Subtractive, AM, FM) ---
    else {
        const freq1 = this.getFrequencyForNote(note, osc1Settings.octave);
        const freq2 = this.getFrequencyForNote(note, osc2Settings.octave);
        if (!freq1 || !freq2) return;

        const osc1 = this.audioContext.createOscillator();
        osc1.type = osc1Settings.waveform;
        osc1.frequency.setValueAtTime(freq1, now);
        osc1.detune.setValueAtTime(this.currentPitchBend + osc1Settings.detune, now);

        const osc2 = this.audioContext.createOscillator();
        osc2.type = osc2Settings.waveform;
        osc2.frequency.setValueAtTime(freq2, now);
        osc2.detune.setValueAtTime(this.currentPitchBend + osc2Settings.detune, now);
        
        const mix1Gain = this.audioContext.createGain();
        mix1Gain.gain.value = 1 - mix;
        const mix2Gain = this.audioContext.createGain();
        mix2Gain.gain.value = mix;

        // Create a specific gain node for AM/Tremolo
        const amGain = this.audioContext.createGain();
        // Default to unity gain. Logic below modifies this for Ring Mod.
        amGain.gain.value = 1.0; 

        osc1.connect(mix1Gain);
        osc2.connect(mix2Gain);
        mix1Gain.connect(amGain);
        mix2Gain.connect(amGain);
        amGain.connect(adsrGain);

        const sources: (OscillatorNode | GainNode)[] = [osc1, osc2, amGain];

        // --- LFO MODULATION ---
        if (this.lfoSettings.on) {
            // KEY SYNC FM (Linear Frequency Modulation)
            // True FM: Modulator affects Frequency directly, not Pitch (logarithmic).
            if (this.lfoSettings.keySync && this.lfoTarget === 'pitch') {
                const mod = this.audioContext.createOscillator();
                mod.type = this.lfoSettings.waveform;
                const modRatio = this.lfoSettings.rate; 
                mod.frequency.setValueAtTime(freq1 * modRatio, now);
                
                const modGain = this.audioContext.createGain();
                // Boosted Index: Allow deep modulation for rich "Digital FM" sounds.
                // Index of 3-4 creates rich sidebands (like bells/brass).
                // The 'depth' slider (0-1) now maps to Index 0 to 4.
                const MAX_FM_INDEX = 4.0;
                const modulationIndex = this.lfoSettings.depth * MAX_FM_INDEX; 
                modGain.gain.setValueAtTime(modulationIndex * freq1, now); 
                
                mod.connect(modGain);
                modGain.connect(osc1.frequency); 
                if (!osc1Settings.detune && !osc2Settings.detune) {
                     modGain.connect(osc2.frequency); 
                }
                mod.start(now);
                sources.push(mod);
            } 
            // KEY SYNC AM (Polyphonic AM / Ring Mod)
            // True AM: Interpolates from Tremolo -> AM -> Ring Mod
            else if (this.lfoSettings.keySync && this.lfoTarget === 'amplitude') {
                const mod = this.audioContext.createOscillator();
                mod.type = this.lfoSettings.waveform;
                const modRatio = this.lfoSettings.rate;
                mod.frequency.setValueAtTime(freq1 * modRatio, now);

                const modGain = this.audioContext.createGain();
                modGain.gain.setValueAtTime(this.lfoSettings.depth, now);

                // TRUE AM LOGIC:
                // As depth increases, we lower the carrier bias (DC offset).
                // Depth 0.0 -> Bias 1.0, Mod 0.0 (Unmodulated)
                // Depth 0.5 -> Bias 0.5, Mod 0.5 (100% AM, unipolar)
                // Depth 1.0 -> Bias 0.0, Mod 1.0 (Ring Modulation, bipolar)
                const carrierBias = 1.0 - this.lfoSettings.depth;
                amGain.gain.setValueAtTime(carrierBias, now);

                mod.connect(modGain);
                modGain.connect(amGain.gain);
                mod.start(now);
                sources.push(mod);
            }
            // STANDARD LFO (Global Pitch/Detune Modulation)
            else if (this.lfoTarget === 'pitch' && !this.lfoSettings.keySync) {
                this.lfoGain.connect(osc1.detune);
                this.lfoGain.connect(osc2.detune);
            }
            // Standard Global LFO (Amplitude/Filter) is handled in updateLFO globally
        }

        osc1.start(now);
        osc2.start(now);
        
        this.activeNodes.set(note, { sources, adsrGain, osc1Settings, osc2Settings, rootNote: finalRootNote });
    }

    const { attack, decay, sustain } = envelope;
    const peakGain = 0.25;
    adsrGain.gain.linearRampToValueAtTime(peakGain, now + attack);
    adsrGain.gain.linearRampToValueAtTime(sustain * peakGain, now + attack + decay);

    this.scheduleRetune();
  }

  public stopNote(note: string, release: number, time?: number): void {
    const activeNode = this.activeNodes.get(note);
    if (!activeNode) return;

    const { sources, adsrGain } = activeNode;
    const now = time ?? this.audioContext.currentTime;

    // Avoid abrupt cuts for active envelopes
    adsrGain.gain.cancelScheduledValues(now);
    const currentGain = adsrGain.gain.value;
    // If no explicit time provided, set current value anchor. If future time, the anchor is the sustain value.
    if (!time) adsrGain.gain.setValueAtTime(currentGain, now);
    
    const effectiveRelease = Math.max(release, 0.01);
    adsrGain.gain.setTargetAtTime(0, now, effectiveRelease / 3); // Tighter exponential decay

    const stopTime = now + effectiveRelease + 0.05;
    sources.forEach(source => {
        if (source instanceof OscillatorNode || source instanceof AudioBufferSourceNode) {
            source.stop(stopTime);
        }
    });

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
        if (node.osc1Settings && node.osc2Settings) {
             const s1 = node.sources[0];
             const s2 = node.sources[1];
             if(s1 instanceof OscillatorNode) s1.detune.setTargetAtTime(cents + node.osc1Settings.detune, now, 0.01);
             if(s2 instanceof OscillatorNode) s2.detune.setTargetAtTime(cents + node.osc2Settings.detune, now, 0.01);
        }
    });
  }
  
  public setAdaptiveTuning(enabled: boolean): void {
    this.adaptiveTuningEnabled = enabled;
    this.resetTuning();
    if (enabled) this.scheduleRetune();
  }
  
  public updateLFO(settings: LFOSettings) {
    this.lfoSettings = settings;
    const now = this.audioContext.currentTime;
    const previousTarget = this.lfoTarget;

    // Update Global LFO
    this.lfo.type = settings.waveform;
    this.lfo.frequency.setTargetAtTime(settings.rate, now, 0.02);

    // Optimize updates if target hasn't changed
    if (settings.on && previousTarget === settings.target && !settings.keySync) {
        if (settings.target === 'filter') this.lfoGain.gain.setTargetAtTime(settings.depth * 2400, now, 0.02);
        if (settings.target === 'amplitude') this.lfoGain.gain.setTargetAtTime(settings.depth, now, 0.02);
        if (settings.target === 'pitch') this.lfoGain.gain.setTargetAtTime(settings.depth * 3600, now, 0.02);
        return;
    }

    // Disconnect old targets
    this.lfoGain.disconnect();
    
    if (previousTarget === 'amplitude') {
        this.tremoloGain.gain.cancelScheduledValues(now);
        this.tremoloGain.gain.setTargetAtTime(1.0, now, 0.01);
    }

    this.lfoTarget = settings.on ? settings.target : 'none';

    if (!settings.on) return;
    
    // If KeySync is enabled, modulation is handled per-voice in playNote. 
    if (settings.keySync && (settings.target === 'pitch' || settings.target === 'amplitude')) {
        return; 
    }

    // Reconnect Global Targets
    if (settings.target === 'filter') {
        this.lfoGain.gain.setTargetAtTime(settings.depth * 2400, now, 0.02);
        this.lfoGain.connect(this.filterNode.frequency);
    } else if (settings.target === 'amplitude') {
        this.lfoGain.gain.setTargetAtTime(settings.depth, now, 0.02);
        this.lfoGain.connect(this.tremoloGain.gain);
    } else if (settings.target === 'pitch') {
        this.lfoGain.gain.setTargetAtTime(settings.depth * 3600, now, 0.02);
        this.activeNodes.forEach(node => {
             const s1 = node.sources[0];
             const s2 = node.sources[1];
             if (s1 instanceof OscillatorNode) this.lfoGain.connect(s1.detune);
             if (s2 instanceof OscillatorNode) this.lfoGain.connect(s2.detune);
        });
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
        if (node.osc1Settings && node.osc2Settings && node.sources[0] instanceof OscillatorNode) {
            const standardFreq1 = this.getFrequencyForNote(noteName, node.osc1Settings.octave);
            const standardFreq2 = this.getFrequencyForNote(noteName, node.osc2Settings.octave);
            (node.sources[0] as OscillatorNode).frequency.setTargetAtTime(standardFreq1, now, 0.003);
            if (node.sources[1] instanceof OscillatorNode) {
                (node.sources[1] as OscillatorNode).frequency.setTargetAtTime(standardFreq2, now, 0.003);
            }
        }
    });
  }
  
  private tuneNote(noteName: string, rootFrequency: number, rootIndex: number, now: number): void {
    const node = this.activeNodes.get(noteName);
    if (!node || !node.osc1Settings || !node.osc2Settings) return;
    
    const s1 = node.sources[0];
    const s2 = node.sources[1];
    
    const noteIndex = this.noteToIndexMap.get(noteName) ?? 0;
    const interval = noteIndex - rootIndex;
    const semitonesInOctave = interval % 12;
    const octaveOffset = Math.floor(interval / 12);

    const ratio = JUST_INTONATION_RATIOS[semitonesInOctave < 0 ? semitonesInOctave + 12 : semitonesInOctave];
    const targetFrequency = rootFrequency * ratio * Math.pow(2, octaveOffset);

    const targetFreq1 = targetFrequency * Math.pow(2, node.osc1Settings.octave);
    const targetFreq2 = targetFrequency * Math.pow(2, node.osc2Settings.octave);

    // Use a slower time constant (0.1s) to make the tuning adjustment visible and audible as a slide
    if (s1 instanceof OscillatorNode) s1.frequency.setTargetAtTime(targetFreq1, now, 0.1);
    if (s2 instanceof OscillatorNode) s2.frequency.setTargetAtTime(targetFreq2, now, 0.1);
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
        const { adsr, osc1: osc1Settings, osc2: osc2Settings, mix, sampleVolume } = settings;
        
        // Sampling logic for offline rendering?
        // Note: This simplified render currently only handles oscillators properly. 
        // Rendering samples offline would require fetching the sample buffer which is complicated in this scope.
        // We will keep the oscillator logic for now, but if sampleVolume is present, we could theoretically apply it if we had the sample source.
        
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
        const peakGain = 0.25; 
        
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
