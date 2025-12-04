

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Keyboard } from './components/Keyboard';
import { Controls } from './components/Controls';
import { AudioEngine } from './services/audioService';
import type { ADSREnvelope, OscillatorSettings, SynthPreset, ChordMode, ReverbSettings, DelaySettings, FilterSettings, SaturationSettings, ChorusSettings, PhaserSettings, LFOSettings, PresetCategory, ArpeggiatorSettings, SongMeasure, SongPattern, DrumPattern, ArrangementBlock } from './types';
import { KEY_MAP, SYNTH_PRESETS, KEYBOARD_NOTES, DEFAULT_FILTER_SETTINGS, DEFAULT_REVERB_SETTINGS, DEFAULT_DELAY_SETTINGS, DEFAULT_SATURATION_SETTINGS, DEFAULT_CHORUS_SETTINGS, DEFAULT_PHASER_SETTINGS, DEFAULT_LFO_SETTINGS, DEFAULT_ARP_SETTINGS } from './constants';
import { SidePanel } from './components/SidePanel';
import { SequencerPanel } from './components/SequencerPanel';
import { useMetronome } from './hooks/useMetronome';
import { useLooper } from './hooks/useLooper';
import { encodeWAV } from './services/wavEncoder';
import { getChordNotes, getDiatonicChordNotesForKey, getDisplayKeys, formatNoteName, detectChordFromNotes } from './services/musicTheory';
import { SettingsPanel } from './components/SettingsPanel';
import { ChordHelperPanel as ChordToolsPanel } from './components/ChordHelperPanel';
import { EffectsPanel } from './components/EffectsPanel';
import { LFOPanel } from './components/LFOPanel';
import { ArpeggiatorPanel } from './components/ArpeggiatorPanel';
import { useArpeggiator } from './hooks/useArpeggiator';
import { SongBuilderPanel } from './components/SongBuilderPanel';
import { ArrangerPanel } from './components/ArrangerPanel';
import { useSongPlayer } from './hooks/useSongPlayer';

const PITCH_BEND_AMOUNT = 200;

// Simple ID generator to avoid crypto environment issues
const generateId = () => Math.random().toString(36).substring(2, 9);

const THEMES: Record<PresetCategory, { primary: string; secondary: string }> = {
    'Simple': { primary: '0 255 255', secondary: '138 43 226' }, // Cyan / Purple
    'Subtractive': { primary: '255 165 0', secondary: '220 20 60' }, // Orange / Red
    'AM': { primary: '255 20 147', secondary: '75 0 130' }, // Deep Pink / Indigo
    'FM': { primary: '255 0 255', secondary: '255 215 0' }, // Magenta / Gold
    '808': { primary: '255 182 193', secondary: '137 207 240' }, // Pastel Pink / Pastel Blue
    'Sampling': { primary: '16 185 129', secondary: '13 148 136' }, // Emerald / Teal
};

const usePrevious = <T extends unknown>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);
  const prevValue = ref.current;
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return prevValue;
};

const transposeNote = (note: string, octaveOffset: number): string => {
    if (octaveOffset === 0) return note;
    const match = note.match(/([A-G]#?)([0-9])/);
    if (match) {
        const noteName = match[1];
        const octave = parseInt(match[2], 10);
        return `${noteName}${octave + octaveOffset}`;
    }
    return note;
};

// Helper to reverse the octave offset for UI highlighting
const untransposeNote = (finalNote: string, octaveOffset: number): string => {
    if (octaveOffset === 0) return finalNote;
    const match = finalNote.match(/([A-G](?:#|b)?)([0-9])/);
    if (match) {
        const noteName = match[1];
        const octave = parseInt(match[2], 10);
        return `${noteName}${octave - octaveOffset}`;
    }
    return finalNote;
};

const midiToNoteName = (midiNote: number): string => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  return `${noteNames[noteIndex]}${octave}`;
};

const App: React.FC = () => {
  // --- SYNTH STATE ---
  const [adsr, setAdsr] = useState<ADSREnvelope>(SYNTH_PRESETS[0].adsr);
  const [osc1, setOsc1] = useState<OscillatorSettings>(SYNTH_PRESETS[0].osc1);
  const [osc2, setOsc2] = useState<OscillatorSettings>(SYNTH_PRESETS[0].osc2);
  const [oscMix, setOscMix] = useState<number>(SYNTH_PRESETS[0].mix);
  const [activePresetName, setActivePresetName] = useState<string>(SYNTH_PRESETS[0].name);
  const [activeCategory, setActiveCategory] = useState<PresetCategory>(SYNTH_PRESETS[0].category);

  // --- APP & AUDIO STATE ---
  const [pressedNotes, setPressedNotes] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const [octaveOffset, setOctaveOffset] = useState(0);
  const [pitchBend, setPitchBend] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.75);
  
  const [sustainOn, setSustainOn] = useState(false);
  const [sustainedNotes, setSustainedNotes] = useState<Map<string, number>>(new Map());
  const [sustainedChords, setSustainedChords] = useState<Map<string, { notes: string[], offset: number }>>(new Map());
  const [loopBars, setLoopBars] = useState<number>(4);
  const [loopBuffer, setLoopBuffer] = useState<AudioBuffer | null>(null);
  
  // --- SAMPLER STATE ---
  const [sampleBuffer, setSampleBuffer] = useState<AudioBuffer | null>(null);
  const [sampleVolume, setSampleVolume] = useState(0.5);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(1);
  const [sampleLoop, setSampleLoop] = useState(false);
  const [sampleBpm, setSampleBpm] = useState<number>(120);
  
  // --- SEQUENCER & DRUM STATE ---
  const [sequencerMode, setSequencerMode] = useState<'metronome' | 'drums'>('metronome');
  const sequencerModeRef = useRef(sequencerMode); 
  useEffect(() => { sequencerModeRef.current = sequencerMode; }, [sequencerMode]);

  const [drumPattern, setDrumPattern] = useState<DrumPattern>({
      kick: Array(16).fill(false),
      snare: Array(16).fill(false),
      hihat: Array(16).fill(false)
  });
  // Ref for immediate access in audio scheduler
  const drumPatternRef = useRef(drumPattern);
  useEffect(() => { drumPatternRef.current = drumPattern; }, [drumPattern]);
  
  // --- MIDI STATE ---
  const [midiDeviceName, setMidiDeviceName] = useState<string | null>(null);
  const [midiPressedNotes, setMidiPressedNotes] = useState<Set<string>>(new Set());
  const [midiSustainedNotes, setMidiSustainedNotes] = useState<Set<string>>(new Set());


  // --- UI SETTINGS STATE ---
  const [keyboardDisplayMode, setKeyboardDisplayMode] = useState<'noteNames' | 'notation' | 'solfege' | 'hz'>('noteNames');
  const [solfegeKey, setSolfegeKey] = useState('C');
  const [preferFlats, setPreferFlats] = useState(false);
  const [adaptiveTuning, setAdaptiveTuning] = useState(true);
  const [showTooltips, setShowTooltips] = useState(true);
  const [noteFrequencies, setNoteFrequencies] = useState<Map<string, number>>(new Map());


  // --- CHORD TOOLS STATE ---
  const [autoChordsOn, setAutoChordsOn] = useState(false);
  const [chordMode, setChordMode] = useState<ChordMode>('diatonic');
  const [diatonicScale, setDiatonicScale] = useState<'major' | 'minor'>('major');
  const [chordHelperOn, setChordHelperOn] = useState(false);
  const [musicKey, setMusicKey] = useState('C');
  
  // --- EFFECTS STATE ---
  const [reverbSettings, setReverbSettings] = useState<ReverbSettings>(DEFAULT_REVERB_SETTINGS);
  const [delaySettings, setDelaySettings] = useState<DelaySettings>(DEFAULT_DELAY_SETTINGS);
  const [filterSettings, setFilterSettings] = useState<FilterSettings>(DEFAULT_FILTER_SETTINGS);
  const [saturationSettings, setSaturationSettings] = useState<SaturationSettings>(DEFAULT_SATURATION_SETTINGS);
  const [chorusSettings, setChorusSettings] = useState<ChorusSettings>(DEFAULT_CHORUS_SETTINGS);
  const [phaserSettings, setPhaserSettings] = useState<PhaserSettings>(DEFAULT_PHASER_SETTINGS);
  const [lfoSettings, setLfoSettings] = useState<LFOSettings>(DEFAULT_LFO_SETTINGS);

  // --- ARPEGGIATOR STATE ---
  const [arpSettings, setArpSettings] = useState<ArpeggiatorSettings>(DEFAULT_ARP_SETTINGS);

  // --- SONG BUILDER & ARRANGER STATE ---
  const [songPatterns, setSongPatterns] = useState<SongPattern[]>([
      { id: 'p1', name: 'Pattern 1', sequence: Array(4).fill(null).map(() => ({ id: generateId(), chords: [null] })) }
  ]);
  const [activePatternIndex, setActivePatternIndex] = useState(0);
  const [songArrangement, setSongArrangement] = useState<ArrangementBlock[]>([]);
  const [arrangementPlaying, setArrangementPlaying] = useState(false);
  
  const [sequencerHeldNotes, setSequencerHeldNotes] = useState<Set<string>>(new Set());
  // Separate metronome state for Song Builder
  const [songMetronomeOn, setSongMetronomeOn] = useState(false);

  const activeChordsRef = useRef<Map<string, string[]>>(new Map());
  const [activeChords, setActiveChords] = useState<Map<string, string[]>>(new Map());
  
  const displayKeys = useMemo(() => getDisplayKeys(preferFlats), [preferFlats]);

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const prevOctaveOffset = usePrevious(octaveOffset);
  const sustainOnRef = useRef(sustainOn); 
  useEffect(() => { sustainOnRef.current = sustainOn; }, [sustainOn]);

  // Arpeggiator needs to be defined BEFORE useMetronome to extract onExternalClockStep
  // Combine all inputs for Arp: Pressed keys, MIDI, Sustained keys, Sequencer (Song Builder)
  const allHeldNotes = useMemo(() => {
      const combined = new Set(sequencerHeldNotes); // Start with sequencer notes (already chords)

      // Add sustained chords (already chords)
      sustainedChords.forEach(data => data.notes.forEach(n => combined.add(n)));

      const addNotes = (notes: Iterable<string>) => {
          for (const note of notes) {
              if (autoChordsOn) {
                  const chordNotes = getChordNotes(note, chordMode, { key: musicKey, scale: diatonicScale });
                  chordNotes.forEach(n => combined.add(n));
              } else {
                  combined.add(note);
              }
          }
      };

      addNotes(pressedNotes);
      addNotes(midiPressedNotes);
      addNotes(sustainedNotes.keys());

      return combined;
  }, [pressedNotes, midiPressedNotes, sustainedNotes, sustainedChords, sequencerHeldNotes, autoChordsOn, chordMode, musicKey, diatonicScale]);

  const handleArpPlayNote = useCallback((note: string, time: number, duration: number) => {
      if (!audioEngineRef.current) return;
      const settings = synthSettingsRef.current;
      
      audioEngineRef.current.playNote(
          note, 
          settings.adsr, 
          settings.osc1, 
          settings.osc2, 
          settings.oscMix, 
          time, 
          note, 
          settings.activeCategory,
          settings.warpRatio,
          settings.activePresetName
      );

      audioEngineRef.current.stopNote(note, settings.adsr.release, time + duration);
  }, []);

  // We need to know if Metronome is playing for the Arpeggiator hook, 
  // but useMetronome (which controls it) is defined below. 
  // We use a state that is synced or the hook instance itself.
  // Ideally, useMetronome is called first, but we need onExternalClockStep for its callback.
  // Solution: We use a Ref for onExternalClockStep and update it after useArpeggiator is called.
  const onArpStepRef = useRef<(step: number, time: number) => void>(() => {});

  // Audio scheduler callback for drums AND Arp
  const handleSchedulerStep = useCallback((step: number, time: number) => {
      // 1. Drum Machine Logic
      if (sequencerModeRef.current === 'drums') {
          const pattern = drumPatternRef.current;
          if (pattern.kick[step]) audioEngineRef.current?.playDrum('kick', time);
          if (pattern.snare[step]) audioEngineRef.current?.playDrum('snare', time);
          if (pattern.hihat[step]) audioEngineRef.current?.playDrum('hihat', time);
      }

      // 2. Arpeggiator Sync (always called if metronome is running)
      if (onArpStepRef.current) {
          onArpStepRef.current(step, time);
      }
  }, []);

  const { isMetronomePlaying, bpm, setBpm, toggleMetronome, metronomeTick, beatInfo, currentStep } = useMetronome({
    audioContext: audioEngineRef.current?.getAudioContext() ?? null,
    onStep: handleSchedulerStep,
    muteClick: sequencerMode === 'drums' 
  });

  const { onExternalClockStep } = useArpeggiator({
      bpm,
      settings: arpSettings,
      heldNotes: allHeldNotes,
      audioContext: audioEngineRef.current?.getAudioContext() ?? null,
      onPlayNote: handleArpPlayNote,
      octaveOffset: octaveOffset,
      isExternalClockActive: isMetronomePlaying // Lock Arp to Metronome when playing
  });

  // Sync the ref so handleSchedulerStep can call it
  useEffect(() => {
      onArpStepRef.current = onExternalClockStep;
  }, [onExternalClockStep]);


  // Calculate Warping Factor
  const warpRatio = useMemo(() => {
      if (sampleBpm <= 0) return 1;
      return bpm / sampleBpm;
  }, [bpm, sampleBpm]);

  // Create a ref to hold all synth settings. This avoids stale closures in callbacks.
  const synthSettingsRef = useRef({
    adsr,
    osc1,
    osc2,
    oscMix,
    octaveOffset,
    sustainOn,
    autoChordsOn,
    chordMode,
    musicKey,
    diatonicScale,
    activeCategory,
    activePresetName,
    sampleVolume,
    arpSettings,
    warpRatio
  });

  useEffect(() => {
    synthSettingsRef.current = {
      adsr,
      osc1,
      osc2,
      oscMix,
      octaveOffset,
      sustainOn,
      autoChordsOn,
      chordMode,
      musicKey,
      diatonicScale,
      activeCategory,
      activePresetName,
      sampleVolume,
      arpSettings,
      warpRatio
    };
  }); 

  // --- EFFECT SYNCHRONIZATION ---
  // Sync effects to AudioEngine whenever they change
  useEffect(() => { audioEngineRef.current?.updateFilter(filterSettings); }, [filterSettings]);
  useEffect(() => { audioEngineRef.current?.updateReverb(reverbSettings); }, [reverbSettings]);
  useEffect(() => { audioEngineRef.current?.updateDelay(delaySettings); }, [delaySettings]);
  useEffect(() => { audioEngineRef.current?.updateSaturation(saturationSettings); }, [saturationSettings]);
  useEffect(() => { audioEngineRef.current?.updateChorus(chorusSettings); }, [chorusSettings]);
  useEffect(() => { audioEngineRef.current?.updatePhaser(phaserSettings); }, [phaserSettings]);
  useEffect(() => { audioEngineRef.current?.updateLFO(lfoSettings); }, [lfoSettings]);
  
  useEffect(() => { audioEngineRef.current?.setPitchBend(pitchBend); }, [pitchBend]);
  useEffect(() => { audioEngineRef.current?.setAdaptiveTuning(adaptiveTuning); }, [adaptiveTuning]);
  useEffect(() => { audioEngineRef.current?.setMasterVolume(masterVolume); }, [masterVolume]);
  useEffect(() => { audioEngineRef.current?.setSampleVolume(sampleVolume); }, [sampleVolume]);


  // --- FREQUENCY MONITORING ---
  // This effect polls the audio engine for the current frequency of active notes
  useEffect(() => {
    if (keyboardDisplayMode !== 'hz') {
        if (noteFrequencies.size > 0) setNoteFrequencies(new Map());
        return;
    }

    let animationFrameId: number;
    
    const updateFrequencies = () => {
        if (audioEngineRef.current) {
            const freqs = audioEngineRef.current.getLiveFrequencies();
            setNoteFrequencies(freqs);
        }
        animationFrameId = requestAnimationFrame(updateFrequencies);
    };
    
    updateFrequencies();
    
    return () => {
        cancelAnimationFrame(animationFrameId);
    };
  }, [keyboardDisplayMode, isInitialized]);


  const looperNoteOn = useCallback((note: string, time?: number) => {
    const settings = synthSettingsRef.current;
    audioEngineRef.current?.playNote(
        note, 
        settings.adsr, 
        settings.osc1, 
        settings.osc2, 
        settings.oscMix, 
        time, 
        undefined, 
        settings.activeCategory, 
        settings.warpRatio,
        settings.activePresetName
    );
  }, []);

  const looperNoteOff = useCallback((note: string, time?: number) => {
    audioEngineRef.current?.stopNote(note, synthSettingsRef.current.adsr.release, time);
  }, []);

  const { 
    loopState, 
    loop, 
    progress, 
    startRecording, 
    togglePlayback, 
    clearLoop,
    noteOn: looperRecordNoteOn,
    noteOff: looperRecordNoteOff,
    countInMeasure,
    playbackStartTime,
  } = useLooper({
    bpm,
    bars: loopBars,
    audioContext: audioEngineRef.current?.getAudioContext() ?? null,
    isMetronomePlaying,
    beatInfo,
    onPlayNote: looperNoteOn,
    onStopNote: looperNoteOff,
    onStopAllLoopNotes: () => audioEngineRef.current?.stopAllNotes(),
  });
  
  const handleToggleMetronome = () => {
    // If we have a loop playing, sync the metronome to it
    const syncTime = (loopState === 'playing' || loopState === 'overdubbing') ? playbackStartTime : undefined;
    toggleMetronome(syncTime);
  };
  
  const [isDownloading, setIsDownloading] = useState(false);


  // --- NOTE HANDLING ---

  const handleNoteDown = useCallback((note: string) => {
    if (!isInitialized || !audioEngineRef.current) return;
    
    const settings = synthSettingsRef.current;
    
    // Add to pressed notes (this triggers Arp via hook if ON)
    setPressedNotes(prev => new Set(prev).add(note));
    
    // If Arp is ON, we DON'T play audio directly.
    if (settings.arpSettings.on) return;

    const finalRootNote = transposeNote(note, settings.octaveOffset);

    if (settings.autoChordsOn) {
        const chordNotes = getChordNotes(finalRootNote, settings.chordMode, { key: settings.musicKey, scale: settings.diatonicScale });
        activeChordsRef.current.set(note, chordNotes);
        setActiveChords(prev => new Map(prev).set(note, chordNotes));
        chordNotes.forEach(chordNote => {
            audioEngineRef.current?.playNote(chordNote, settings.adsr, settings.osc1, settings.osc2, settings.oscMix, undefined, finalRootNote, settings.activeCategory, settings.warpRatio, settings.activePresetName);
            looperRecordNoteOn(chordNote);
        });
    } else {
        audioEngineRef.current.playNote(finalRootNote, settings.adsr, settings.osc1, settings.osc2, settings.oscMix, undefined, undefined, settings.activeCategory, settings.warpRatio, settings.activePresetName);
        looperRecordNoteOn(finalRootNote);
    }
    
    // If we press a key that was sustained, we remove it from the sustain map (re-triggering)
    setSustainedNotes(prev => { const newMap = new Map(prev); newMap.delete(note); return newMap; });
    setSustainedChords(prev => { const newMap = new Map(prev); newMap.delete(note); return newMap; });

  }, [isInitialized, looperRecordNoteOn]);

  const handleNoteUp = useCallback((note: string) => {
    if (!isInitialized || !audioEngineRef.current) return;
    
    const settings = synthSettingsRef.current;
    
    // Remove from pressed notes
    setPressedNotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(note);
        return newSet;
    });

    // ARPEGGIATOR LOGIC WITH SUSTAIN
    if (settings.arpSettings.on) {
        // If sustain pedal is held, we add the released note to 'sustainedNotes'
        // so it remains in the 'allHeldNotes' set for the Arp.
        if (settings.sustainOn) {
            setSustainedNotes(prev => new Map(prev).set(note, settings.octaveOffset));
        }
        return;
    }

    // NORMAL PLAY LOGIC
    const stopSingleNote = () => {
        const finalNote = transposeNote(note, settings.octaveOffset);
        looperRecordNoteOff(finalNote);
        if (settings.sustainOn) {
            setSustainedNotes(prev => new Map(prev).set(note, settings.octaveOffset));
        } else {
            audioEngineRef.current?.stopNote(finalNote, settings.adsr.release);
        }
    };

    const stopChord = () => {
        const chordNotes = activeChordsRef.current.get(note);
        if (chordNotes) {
            chordNotes.forEach(chordNote => looperRecordNoteOff(chordNote));
            if (settings.sustainOn) {
                setSustainedChords(prev => new Map(prev).set(note, { notes: chordNotes, offset: settings.octaveOffset }));
            } else {
                chordNotes.forEach(chordNote => audioEngineRef.current?.stopNote(chordNote, settings.adsr.release));
            }
            activeChordsRef.current.delete(note);
            setActiveChords(prev => { const newMap = new Map(prev); newMap.delete(note); return newMap; });
        }
    };

    if (activeChordsRef.current.has(note)) stopChord();
    else stopSingleNote();
  }, [isInitialized, looperRecordNoteOff]);

  // SUSTAIN PEDAL RELEASE EFFECT
  useEffect(() => {
    if (!sustainOn) {
        // When pedal is released, stop all notes currently in the sustained map
        // UNLESS they are physically pressed again (though usually pressedNotes handles that)
        
        // 1. Stop Single Sustained Notes
        sustainedNotes.forEach((offset, note) => {
             if (!pressedNotes.has(note)) {
                 const finalNote = transposeNote(note, offset);
                 audioEngineRef.current?.stopNote(finalNote, adsr.release);
                 looperRecordNoteOff(finalNote);
             }
        });
        setSustainedNotes(new Map());

        // 2. Stop Sustained Chords
        sustainedChords.forEach(({ notes }, rootNote) => {
            if (!pressedNotes.has(rootNote)) {
                notes.forEach(n => {
                    audioEngineRef.current?.stopNote(n, adsr.release);
                    looperRecordNoteOff(n);
                });
            }
        });
        setSustainedChords(new Map());
    }
  }, [sustainOn, pressedNotes, adsr.release, looperRecordNoteOff]);

  const noteHandlersRef = useRef({ handleNoteDown, handleNoteUp, setSustainOn });
  useEffect(() => {
      noteHandlersRef.current = { handleNoteDown, handleNoteUp, setSustainOn };
  }, [handleNoteDown, handleNoteUp, setSustainOn]);

  const handleConnectMidi = useCallback(async () => {
    if (!(navigator as any).requestMIDIAccess) {
      setMidiDeviceName("Not Supported");
      return;
    }

    setMidiDeviceName("Connecting...");

    try {
      const midiAccess = await (navigator as any).requestMIDIAccess();
      
      const onMidiMessage = (event: any) => {
        const [status, data1, data2] = event.data;
        const command = status & 0xF0;
        const note = data1;
        const velocity = data2;

        if (command === 0x90 && velocity > 0) {
            const noteName = midiToNoteName(note);
            setMidiPressedNotes(prev => new Set(prev).add(noteName));
            noteHandlersRef.current.handleNoteDown(noteName);
        }
        else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
            const noteName = midiToNoteName(note);
            setMidiPressedNotes(prev => {
                const next = new Set(prev);
                next.delete(noteName);
                return next;
            });
            noteHandlersRef.current.handleNoteUp(noteName);
        }
        else if (command === 0xB0 && note === 64) {
             const isPedalDown = velocity >= 64;
             noteHandlersRef.current.setSustainOn(isPedalDown);
        }
      };

      const inputs = midiAccess.inputs.values();
      let deviceFound = false;
      let name = "No Devices Found";
      
      for (let input of inputs) {
          input.onmidimessage = onMidiMessage;
          name = input.name || "MIDI Device";
          deviceFound = true;
      }
      
      setMidiDeviceName(name);
      
      midiAccess.onstatechange = (e: any) => {
           if (e.port.type === 'input' && e.port.state === 'connected' && !deviceFound) {
                e.port.onmidimessage = onMidiMessage;
                setMidiDeviceName(e.port.name);
                deviceFound = true;
           }
      };

    } catch (err) {
      console.error("MIDI Access Failed", err);
      setMidiDeviceName("Access Denied");
    }
  }, []);

  // --- SONG BUILDER LOGIC ---

  // Song Pattern Management
  const handlePatternAdd = () => {
      setSongPatterns(prev => [
          ...prev,
          { 
              id: generateId(), 
              name: `Pattern ${prev.length + 1}`, 
              sequence: Array(4).fill(null).map(() => ({ id: generateId(), chords: [null] })) 
          }
      ]);
      setActivePatternIndex(prev => prev + 1); // Switch to new pattern
  };

  const handlePatternDelete = (index: number) => {
      if (songPatterns.length <= 1) return;
      const newPatterns = songPatterns.filter((_, i) => i !== index);
      setSongPatterns(newPatterns);
      if (activePatternIndex >= index) {
          setActivePatternIndex(Math.max(0, activePatternIndex - 1));
      }
  };

  const handleSequenceChange = (newSequence: SongMeasure[]) => {
      setSongPatterns(prev => {
          const newPatterns = [...prev];
          newPatterns[activePatternIndex] = {
              ...newPatterns[activePatternIndex],
              sequence: newSequence
          };
          return newPatterns;
      });
  };

  const handleSongClear = () => {
      setSongPatterns(prev => {
          const newPatterns = [...prev];
          newPatterns[activePatternIndex] = {
              ...newPatterns[activePatternIndex],
              sequence: Array(4).fill(null).map(() => ({ id: generateId(), chords: [null] }))
          };
          return newPatterns;
      });
  };
  
  // Convert recorded loop to a song pattern
  const handleLoopToPattern = () => {
    if (loop.length === 0) return;

    // Determine loop duration and measure length
    const beatsPerBar = 4;
    const secondsPerBeat = 60 / bpm;
    const measureDuration = secondsPerBeat * beatsPerBar;
    
    // Create new measures
    const newSequence: SongMeasure[] = [];
    
    for (let i = 0; i < loopBars; i++) {
        const measureStart = i * measureDuration;
        const measureEnd = (i + 1) * measureDuration;
        const halfMeasure = measureDuration / 2;
        
        // Analyze notes for Beat 1
        const notesAtBeat1 = new Set<string>();
        const notesAtBeat3 = new Set<string>();
        
        const checkTime1 = measureStart + 0.1; // slightly into the beat
        const checkTime3 = measureStart + halfMeasure + 0.1;
        
        loop.forEach(event => {
            const eventEnd = event.startTime + event.duration;
            
            // Check Beat 1
            if (event.startTime <= checkTime1 && eventEnd >= checkTime1) {
                notesAtBeat1.add(event.note);
            }
            
            // Check Beat 3
            if (event.startTime <= checkTime3 && eventEnd >= checkTime3) {
                notesAtBeat3.add(event.note);
            }
        });
        
        const chord1 = detectChordFromNotes(Array.from(notesAtBeat1));
        const chord2 = detectChordFromNotes(Array.from(notesAtBeat3));
        
        const chords = (chord1 !== chord2 && chord2) ? [chord1, chord2] : [chord1];

        newSequence.push({
            id: generateId(),
            chords: chords
        });
    }
    
    // Add new pattern
    setSongPatterns(prev => [
        ...prev,
        {
            id: generateId(),
            name: `Rec Loop ${prev.length + 1}`,
            sequence: newSequence
        }
    ]);
    // Switch to new pattern
    setActivePatternIndex(songPatterns.length);
  };

  const handleSongPlayStep = useCallback((chordName: string) => {
      const settings = synthSettingsRef.current;
      
      // Check if it is an Absolute Chord (starts with A-G) or Roman Numeral
      const isAbsolute = /^[A-G]/.test(chordName);

      if (isAbsolute) {
          // Parse Absolute Chord Name (e.g., "Cm", "F#7")
          const match = chordName.match(/^([A-G](?:#|b|♭)?)(.*)$/);
          if (match) {
              const root = match[1];
              const suffix = match[2];
              
              let mode: ChordMode = 'major';
              if (suffix === 'm') mode = 'minor';
              else if (suffix === '7') mode = 'dominant7';
              else if (suffix === '°' || suffix === 'dim') mode = 'diminished';
              else if (suffix === '+' || suffix === 'aug') mode = 'augmented';
              else if (suffix === 'sus4') mode = 'major'; 
              else if (suffix === 'sus2') mode = 'major';

              // Default to Octave 4
              const rootNote = `${root}4`;
              
              // Get notes for absolute chord
              const notes = getChordNotes(rootNote, mode, { key: settings.musicKey, scale: settings.diatonicScale });
              
              setSequencerHeldNotes(new Set(notes));
              
              if (!settings.arpSettings.on) {
                  notes.forEach(n => {
                      audioEngineRef.current?.playNote(n, settings.adsr, settings.osc1, settings.osc2, settings.oscMix, undefined, undefined, settings.activeCategory, settings.warpRatio, settings.activePresetName);
                  });
              }
          }
      } else {
          // Parse Roman Numeral (Relative to Key)
          const rawRoman = chordName.replace('°', '').replace('+', ''); 
          const degreeIdx = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'].indexOf(rawRoman.toLowerCase());
          
          if (degreeIdx === -1) return;
          
          // Determine Intervals based on current SCALE setting
          const scaleIntervals = settings.diatonicScale === 'major' 
            ? [0, 2, 4, 5, 7, 9, 11] 
            : [0, 2, 3, 5, 7, 8, 10];
            
          const interval = scaleIntervals[degreeIdx];
          
          // Find Root Note chromatic index
          const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
          let keyIndex = noteNames.indexOf(settings.musicKey);
          if (keyIndex === -1) {
               // Handle flat keys if passed
               const flatToSharp: Record<string, string> = {'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#'};
               if (flatToSharp[settings.musicKey]) keyIndex = noteNames.indexOf(flatToSharp[settings.musicKey]);
               if (keyIndex === -1) keyIndex = 0;
          }
          
          const rootChroma = (keyIndex + interval) % 12;
          const rootNoteName = noteNames[rootChroma]; 
          
          // Assume Octave 4 for the chord root
          const rootNote = `${rootNoteName}4`;
          
          // Generate chord notes based on current scale context
          const notes = getChordNotes(rootNote, 'diatonic', { key: settings.musicKey, scale: settings.diatonicScale });
          
          setSequencerHeldNotes(new Set(notes));
          
          if (!settings.arpSettings.on) {
              notes.forEach(n => {
                  audioEngineRef.current?.playNote(n, settings.adsr, settings.osc1, settings.osc2, settings.oscMix, undefined, undefined, settings.activeCategory, settings.warpRatio, settings.activePresetName);
              });
          }
      }
      
  }, []);
  
  const handleSongStopStep = useCallback((_: string) => {
      setSequencerHeldNotes(prev => {
          const notesToStop = Array.from(prev);
          const settings = synthSettingsRef.current;
          
          if (!settings.arpSettings.on) {
              notesToStop.forEach(n => {
                   audioEngineRef.current?.stopNote(n, settings.adsr.release);
              });
          }
          return new Set();
      });
  }, []);

  // --- ARRANGER PLAYBACK LOGIC ---
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingArrangement = isPlaying && arrangementPlaying;
  const isPlayingPattern = isPlaying && !arrangementPlaying;

  const currentSequence = useMemo(() => {
      if (arrangementPlaying && songArrangement.length > 0) {
          // Flatten the arrangement: Look up pattern by ID and concat their sequences
          return songArrangement.flatMap(block => {
              const pattern = songPatterns.find(p => p.id === block.patternId);
              return pattern ? pattern.sequence : [];
          });
      }
      // Default to current pattern
      return songPatterns[activePatternIndex].sequence;
  }, [arrangementPlaying, songArrangement, songPatterns, activePatternIndex]);

  const { isPlaying: isPlayerActive, togglePlay: toggleSongPlay, currentMeasureIndex, stop: stopSong } = useSongPlayer({
      bpm,
      sequence: currentSequence,
      onPlayChord: handleSongPlayStep,
      onStopChord: handleSongStopStep,
      audioContext: audioEngineRef.current?.getAudioContext() ?? null,
      isMetronomeEnabled: songMetronomeOn
  });

  // Sync local playing state with the hook
  useEffect(() => {
      setIsPlaying(isPlayerActive);
  }, [isPlayerActive]);

  const handlePatternPlayPause = () => {
      if (arrangementPlaying) {
          stopSong();
          setArrangementPlaying(false);
          // Small delay to ensure clean stop before starting pattern
          setTimeout(toggleSongPlay, 50); 
      } else {
          toggleSongPlay();
      }
  };

  const handleArrangementPlayPause = () => {
      if (isPlayingPattern) {
          stopSong();
          // Small delay to switch modes
          setTimeout(() => {
              setArrangementPlaying(true);
              toggleSongPlay();
          }, 50);
      } else {
          if (!isPlayerActive) setArrangementPlaying(true);
          toggleSongPlay();
      }
  };
  
  const handleArrangementStop = () => {
      stopSong();
      setArrangementPlaying(false);
  };

  // Calculate Active Block Index for Arranger UI
  const activeArrangementBlockIndex = useMemo(() => {
      if (!arrangementPlaying || currentMeasureIndex === -1) return -1;
      
      let measureAccumulator = 0;
      for (let i = 0; i < songArrangement.length; i++) {
          const pattern = songPatterns.find(p => p.id === songArrangement[i].patternId);
          const patternLength = pattern?.sequence.length || 0;
          
          if (currentMeasureIndex >= measureAccumulator && currentMeasureIndex < measureAccumulator + patternLength) {
              return i;
          }
          measureAccumulator += patternLength;
      }
      return -1;
  }, [arrangementPlaying, currentMeasureIndex, songArrangement, songPatterns]);


  const highlightedNotes = useMemo(() => {
    const notesToHighlight = new Map<string, string[]>();

    const addHighlight = (note: string, type: string) => {
        if (!notesToHighlight.has(note)) {
            notesToHighlight.set(note, []);
        }
        notesToHighlight.get(note)!.push(type);
    };

    if (chordHelperOn) {
        const chords = {
            'I': getDiatonicChordNotesForKey(musicKey, 1),
            'IV': getDiatonicChordNotesForKey(musicKey, 4),
            'V': getDiatonicChordNotesForKey(musicKey, 5),
            'vi': getDiatonicChordNotesForKey(musicKey, 6),
        };
        chords.I.forEach(note => addHighlight(note, 'I'));
        chords.IV.forEach(note => addHighlight(note, 'IV'));
        chords.V.forEach(note => addHighlight(note, 'V'));
        chords.vi.forEach(note => addHighlight(note, 'vi'));
    }

    const setActive = (baseKey: string) => {
        if (KEYBOARD_NOTES.some(k => k.note === baseKey)) {
            notesToHighlight.set(baseKey, ['active']);
        }
    };

    pressedNotes.forEach(note => setActive(note));
    sustainedNotes.forEach((_, note) => setActive(note)); // Highlight sustained notes too
    midiPressedNotes.forEach(note => setActive(untransposeNote(formatNoteName(note, false), octaveOffset)));
    midiSustainedNotes.forEach(note => setActive(untransposeNote(formatNoteName(note, false), octaveOffset)));
    
    // Highlight Sequencer notes
    sequencerHeldNotes.forEach(note => setActive(untransposeNote(note, octaveOffset)));

    activeChords.forEach((chordNotes) => {
        chordNotes.forEach(chordNote => setActive(untransposeNote(chordNote, octaveOffset)));
    });
    sustainedChords.forEach(({ notes, offset }) => {
        notes.forEach(chordNote => setActive(untransposeNote(chordNote, offset)));
    });
    
    return notesToHighlight;
  }, [pressedNotes, sustainedNotes, midiPressedNotes, midiSustainedNotes, activeChords, sustainedChords, octaveOffset, chordHelperOn, musicKey, sequencerHeldNotes]);


  const handleInit = () => {
    if (!audioEngineRef.current) {
        audioEngineRef.current = new AudioEngine();
        audioEngineRef.current.setSampleVolume(sampleVolume);
        audioEngineRef.current.setMasterVolume(masterVolume);
        audioEngineRef.current.setAdaptiveTuning(adaptiveTuning);
        // Force initialization of effects with current state
        audioEngineRef.current.updateFilter(filterSettings);
        audioEngineRef.current.updateReverb(reverbSettings);
        audioEngineRef.current.updateDelay(delaySettings);
        audioEngineRef.current.updateSaturation(saturationSettings);
        audioEngineRef.current.updateChorus(chorusSettings);
        audioEngineRef.current.updatePhaser(phaserSettings);
        audioEngineRef.current.updateLFO(lfoSettings);
    }
    setIsInitialized(true);
  };
  
  const handleSampleLoad = useCallback(async (arrayBuffer: ArrayBuffer) => {
      if (!audioEngineRef.current) return;
      try {
          const audioContext = audioEngineRef.current.getAudioContext();
          const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
          await audioEngineRef.current.setSample(decodedBuffer);
          setSampleBuffer(decodedBuffer);
          // Set sample BPM to current BPM by default when loading a new sample
          setSampleBpm(bpm); 
      } catch (error) {
          console.error("Error decoding audio sample:", error);
      }
  }, [bpm]); 
  
  const handleTrimChange = (start: number, end: number) => {
      setTrimStart(start);
      setTrimEnd(end);
      if (audioEngineRef.current) {
          audioEngineRef.current.updateSampleSettings(start, end, sampleLoop);
      }
  };

  const handleSampleLoopChange = (loop: boolean) => {
      setSampleLoop(loop);
      if (audioEngineRef.current) {
          audioEngineRef.current.updateSampleSettings(trimStart, trimEnd, loop);
      }
  }

  const handleSampleVolumeChange = (volume: number) => {
      setSampleVolume(volume);
      if (audioEngineRef.current) {
          audioEngineRef.current.setSampleVolume(volume);
      }
  };

  const handlePresetChange = (preset: SynthPreset) => {
    setAdsr(preset.adsr);
    setOsc1(preset.osc1);
    setOsc2(preset.osc2);
    setOscMix(preset.mix);
    setActivePresetName(preset.name);
    setActiveCategory(preset.category);

    // Update effects, falling back to defaults if not specified in preset
    setFilterSettings(preset.filter ?? DEFAULT_FILTER_SETTINGS);
    setReverbSettings(preset.reverb ?? DEFAULT_REVERB_SETTINGS);
    setDelaySettings(preset.delay ?? DEFAULT_DELAY_SETTINGS);
    setSaturationSettings(preset.saturation ?? DEFAULT_SATURATION_SETTINGS);
    setChorusSettings(preset.chorus ?? DEFAULT_CHORUS_SETTINGS);
    setPhaserSettings(preset.phaser ?? DEFAULT_PHASER_SETTINGS);
    setLfoSettings(preset.lfo ?? DEFAULT_LFO_SETTINGS);
  };

  useEffect(() => {
    if (!audioEngineRef.current || prevOctaveOffset === undefined || prevOctaveOffset === octaveOffset) return;

    // If Arp is ON, we don't re-trigger notes on octave shift, the hook handles transposition
    if (synthSettingsRef.current.arpSettings.on) return;

    pressedNotes.forEach(note => {
        if (synthSettingsRef.current.autoChordsOn && activeChordsRef.current.has(note)) {
            activeChordsRef.current.get(note)!.forEach(cn => {
                audioEngineRef.current?.stopNote(cn, 0.01);
                looperRecordNoteOff(cn);
            });
        } else {
            const oldFinalNote = transposeNote(note, prevOctaveOffset);
            audioEngineRef.current?.stopNote(oldFinalNote, 0.01);
            looperRecordNoteOff(oldFinalNote);
        }
        handleNoteDown(note);
    });
  }, [octaveOffset, prevOctaveOffset, pressedNotes, handleNoteDown, looperRecordNoteOff]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input, select, textarea')) return;
      if (event.repeat) return;
      if (event.code === 'Space') { event.preventDefault(); setSustainOn(true); return; }
      
      const key = event.key.toLowerCase();
      if (key >= '1' && key <= '5') { setOctaveOffset(parseInt(key, 10) - 3); return; }
      
      const note = KEY_MAP[key];
      if (note && !pressedNotes.has(note)) handleNoteDown(note);
      else if (key === '-') setPitchBend(-PITCH_BEND_AMOUNT);
      else if (key === '=') setPitchBend(PITCH_BEND_AMOUNT);
    };
    
    const handleKeyUp = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input, select, textarea')) return;
      if (event.code === 'Space') { event.preventDefault(); setSustainOn(false); return; }
      
      const key = event.key.toLowerCase();
      const note = KEY_MAP[key];
      if (note) handleNoteUp(note);
      else if (key === '-' || key === '=') setPitchBend(0);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleNoteDown, handleNoteUp, pressedNotes]);
  
  // Effect to render the loop to a buffer for visualization
  useEffect(() => {
    const renderLoop = async () => {
        if (loop.length > 0 && audioEngineRef.current) {
            try {
                const loopDuration = (60 / bpm) * 4 * loopBars;
                const buffer = await audioEngineRef.current.renderLoopToBuffer(loop, loopDuration, { 
                    adsr, 
                    osc1, 
                    osc2, 
                    mix: oscMix,
                    sampleVolume: synthSettingsRef.current.sampleVolume
                });
                setLoopBuffer(buffer);
            } catch (error) {
                console.error("Failed to render loop for visualization:", error);
                setLoopBuffer(null);
            }
        } else {
            setLoopBuffer(null);
        }
    };

    renderLoop();
  }, [loop, bpm, loopBars, adsr, osc1, osc2, oscMix, sampleVolume]);


  const handleDownload = async () => {
    if (loop.length === 0 || !audioEngineRef.current) return;
    setIsDownloading(true);
    try {
        const loopDuration = (60 / bpm) * 4 * loopBars;
        const audioBuffer = await audioEngineRef.current.renderLoopToBuffer(loop, loopDuration, { 
            adsr: synthSettingsRef.current.adsr, 
            osc1: synthSettingsRef.current.osc1, 
            osc2: synthSettingsRef.current.osc2, 
            mix: synthSettingsRef.current.oscMix,
            sampleVolume: synthSettingsRef.current.sampleVolume
        });
        const wavBlob = encodeWAV(audioBuffer);
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ISL-synth-loop-${bpm}bpm.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to render and download loop:", error);
    } finally {
        setIsDownloading(false);
    }
  };
  
  const currentTheme = THEMES[activeCategory];
  const styleProps = useMemo(() => ({
      '--accent-500': currentTheme.primary,
      '--secondary-500': currentTheme.secondary,
      '--accent-400': currentTheme.primary, // Simplified for now
  } as React.CSSProperties), [currentTheme]);

  if (!isInitialized) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-synth-gray-900" style={styleProps}>
            <div className="text-center p-8 bg-synth-gray-800 rounded-lg shadow-xl border border-[rgb(var(--accent-500))]">
                <h1 className="text-3xl font-bold text-white mb-2 tracking-widest uppercase">ISL Synth</h1>
                <p className="text-lg text-synth-gray-500 mb-8">by Clark Lambert</p>
                <button 
                    onClick={handleInit} 
                    className="px-6 py-3 bg-[rgb(var(--secondary-500))] text-white font-bold rounded-lg hover:opacity-80 transition-opacity focus:outline-none shadow-lg shadow-[rgba(var(--secondary-500),0.3)]"
                >
                    Start Synthesizer
                </button>
            </div>
        </div>
    );
  }

  return (
    <div 
        className="relative min-h-screen bg-synth-gray-800 flex flex-col items-center justify-center p-4 font-sans antialiased transition-colors duration-500"
        style={styleProps}
    >
      <div className="w-full max-w-6xl mx-auto bg-synth-gray-900 shadow-2xl rounded-xl p-4 sm:p-6 lg:p-8 flex flex-col gap-8 transition-colors duration-500 border border-synth-gray-700/50">
        <header className="flex justify-center items-center">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[rgb(var(--accent-500))] to-[rgb(var(--secondary-500))] tracking-widest uppercase filter drop-shadow-[0_0_2px_rgba(var(--accent-500),0.5)]">
                ISL Synth
            </h1>
        </header>
        
        <main className="flex flex-col gap-8">
          <Controls 
            key={activeCategory} // Force re-render on category change for visualizer theme update
            adsr={adsr} setAdsr={setAdsr}
            osc1={osc1} setOsc1={setOsc1}
            osc2={osc2} setOsc2={setOsc2}
            oscMix={oscMix} setOscMix={setOscMix}
            onPresetChange={handlePresetChange}
            activePresetName={activePresetName}
            activeCategory={activeCategory}
            analyserX={audioEngineRef.current?.analyserX ?? null}
            analyserY={audioEngineRef.current?.analyserY ?? null}
            showTooltips={showTooltips}
            onSampleLoad={handleSampleLoad}
            sampleBuffer={sampleBuffer}
            trimStart={trimStart}
            trimEnd={trimEnd}
            onTrimChange={handleTrimChange}
            sampleVolume={sampleVolume}
            onSampleVolumeChange={handleSampleVolumeChange}
            sampleLoop={sampleLoop}
            onSampleLoopChange={handleSampleLoopChange}
            sampleBpm={sampleBpm}
            onSampleBpmChange={setSampleBpm}
          />
          <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <LFOPanel
                    settings={lfoSettings}
                    onSettingsChange={setLfoSettings}
                    showTooltips={showTooltips}
                />
              </div>
              <div className="flex-1">
                  <ArpeggiatorPanel
                      settings={arpSettings}
                      onSettingsChange={setArpSettings}
                      showTooltips={showTooltips}
                  />
              </div>
          </div>
        </main>
      </div>

      <div className="w-full max-w-6xl mx-auto mt-4 flex items-stretch gap-4">
        <SidePanel 
          octaveOffset={octaveOffset}
          onOctaveChange={setOctaveOffset}
          pitchBend={pitchBend}
          maxPitchBend={PITCH_BEND_AMOUNT}
          sustainOn={sustainOn}
          masterVolume={masterVolume}
          onMasterVolumeChange={setMasterVolume}
          showTooltips={showTooltips}
        />
        <div className="flex-grow flex flex-col">
          <Keyboard 
            onNoteDown={handleNoteDown}
            onNoteUp={handleNoteUp}
            highlightedNotes={highlightedNotes}
            octaveOffset={octaveOffset}
            keyboardDisplayMode={keyboardDisplayMode}
            solfegeKey={solfegeKey}
            preferFlats={preferFlats}
            noteFrequencies={noteFrequencies}
          />
          
           <div className="mt-4">
               <SequencerPanel
                    bpm={bpm}
                    onBpmChange={setBpm}
                    isMetronomePlaying={isMetronomePlaying}
                    onToggleMetronome={handleToggleMetronome}
                    metronomeTick={metronomeTick}
                    loopState={loopState}
                    onRecord={startRecording}
                    onPlay={togglePlayback}
                    onClear={clearLoop}
                    onDownload={handleDownload}
                    loopProgress={progress}
                    isDownloading={isDownloading}
                    hasLoop={loop.length > 0}
                    countInBeat={loopState === 'countingIn' ? beatInfo.beat : 0}
                    countInMeasure={countInMeasure}
                    loopBars={loopBars}
                    onLoopBarsChange={setLoopBars}
                    isLooping={loopState !== 'idle'}
                    loopBuffer={loopBuffer}
                    showTooltips={showTooltips}
                    drumPattern={drumPattern}
                    onDrumPatternChange={setDrumPattern}
                    currentStep={currentStep}
                    mode={sequencerMode}
                    onModeChange={setSequencerMode}
                    onAddToPatterns={handleLoopToPattern}
                />
           </div>
           
           <div className="mt-4">
              <ChordToolsPanel
                autoChordsOn={autoChordsOn}
                onToggleAutoChords={setAutoChordsOn}
                chordMode={chordMode}
                onModeChange={setChordMode}
                diatonicScale={diatonicScale}
                onDiatonicScaleChange={setDiatonicScale}
                chordHelperOn={chordHelperOn}
                onToggleChordHelper={setChordHelperOn}
                selectedKey={musicKey}
                onKeyChange={setMusicKey}
                displayKeys={displayKeys}
                preferFlats={preferFlats}
                showTooltips={showTooltips}
              />
          </div>

          <div className="mt-4">
            <EffectsPanel 
              reverb={reverbSettings}
              onReverbChange={setReverbSettings}
              delay={delaySettings}
              onDelayChange={setDelaySettings}
              filter={filterSettings}
              onFilterChange={setFilterSettings}
              saturation={saturationSettings}
              onSaturationChange={setSaturationSettings}
              chorus={chorusSettings}
              onChorusChange={setChorusSettings}
              phaser={phaserSettings}
              onPhaserChange={setPhaserSettings}
              showTooltips={showTooltips}
            />
          </div>

          <div className="mt-4">
              <SongBuilderPanel 
                patterns={songPatterns}
                activePatternIndex={activePatternIndex}
                onPatternChange={setActivePatternIndex}
                onPatternAdd={handlePatternAdd}
                onPatternDelete={handlePatternDelete}
                onSequenceChange={handleSequenceChange}
                isPlaying={isPlayingPattern}
                onPlayPause={handlePatternPlayPause}
                onClear={handleSongClear}
                currentMeasureIndex={currentMeasureIndex}
                musicKey={musicKey}
                onKeyChange={setMusicKey}
                scale={diatonicScale}
                onScaleChange={setDiatonicScale}
                showTooltips={showTooltips}
                displayKeys={displayKeys}
                isMetronomePlaying={songMetronomeOn}
                onToggleMetronome={() => setSongMetronomeOn(prev => !prev)}
              />
          </div>

          <div className="mt-4">
              <ArrangerPanel 
                  patterns={songPatterns}
                  arrangement={songArrangement}
                  onArrangementChange={setSongArrangement}
                  isPlaying={isPlayingArrangement}
                  onPlayPause={handleArrangementPlayPause}
                  onStop={handleArrangementStop}
                  currentBlockIndex={activeArrangementBlockIndex}
                  showTooltips={showTooltips}
              />
          </div>

          <div className="mt-4">
            <SettingsPanel 
                adaptiveTuning={adaptiveTuning}
                onAdaptiveTuningChange={setAdaptiveTuning}
                keyboardDisplayMode={keyboardDisplayMode}
                onKeyboardDisplayModeChange={setKeyboardDisplayMode}
                solfegeKey={solfegeKey}
                onSolfegeKeyChange={setSolfegeKey}
                preferFlats={preferFlats}
                onPreferFlatsChange={setPreferFlats}
                displayKeys={displayKeys}
                midiDeviceName={midiDeviceName}
                onConnectMidi={handleConnectMidi}
                showTooltips={showTooltips}
                onShowTooltipsChange={setShowTooltips}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;