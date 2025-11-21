
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Keyboard } from './components/Keyboard';
import { Controls } from './components/Controls';
import { AudioEngine } from './services/audioService';
import type { ADSREnvelope, OscillatorSettings, SynthPreset, ChordMode, ReverbSettings, DelaySettings, FilterSettings, SaturationSettings, ChorusSettings, PhaserSettings, LFOSettings, PresetCategory, ArpeggiatorSettings, SongMeasure, SongPattern } from './types';
import { KEY_MAP, SYNTH_PRESETS, KEYBOARD_NOTES, DEFAULT_FILTER_SETTINGS, DEFAULT_REVERB_SETTINGS, DEFAULT_DELAY_SETTINGS, DEFAULT_SATURATION_SETTINGS, DEFAULT_CHORUS_SETTINGS, DEFAULT_PHASER_SETTINGS, DEFAULT_LFO_SETTINGS, DEFAULT_ARP_SETTINGS } from './constants';
import { SidePanel } from './components/SidePanel';
import { Visualizer } from './components/Visualizer';
import { SequencerPanel } from './components/SequencerPanel';
import { useMetronome } from './hooks/useMetronome';
import { useLooper } from './hooks/useLooper';
import { encodeWAV } from './services/wavEncoder';
import { getChordNotes, getDiatonicChordNotesForKey, getDisplayKeys, formatNoteName } from './services/musicTheory';
import { SettingsPanel } from './components/SettingsPanel';
import { ChordHelperPanel as ChordToolsPanel } from './components/ChordHelperPanel';
import { EffectsPanel } from './components/EffectsPanel';
import { LFOPanel } from './components/LFOPanel';
import { ArpeggiatorPanel } from './components/ArpeggiatorPanel';
import { useArpeggiator } from './hooks/useArpeggiator';
import { SongBuilderPanel } from './components/SongBuilderPanel';
import { useSongPlayer } from './hooks/useSongPlayer';

const PITCH_BEND_AMOUNT = 200;

const THEMES: Record<PresetCategory, { primary: string; secondary: string }> = {
    'Simple': { primary: '0 255 255', secondary: '138 43 226' }, // Cyan / Purple
    'Subtractive': { primary: '255 165 0', secondary: '220 20 60' }, // Orange / Red
    'AM': { primary: '255 20 147', secondary: '75 0 130' }, // Deep Pink / Indigo
    'Sampling': { primary: '16 185 129', secondary: '13 148 136' }, // Emerald / Teal
    'FM': { primary: '255 0 255', secondary: '255 215 0' }, // Magenta / Gold
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

  // --- SONG BUILDER STATE ---
  // Initialize with 1 slot per measure
  const [songPatterns, setSongPatterns] = useState<SongPattern[]>([
      { id: 'p1', name: 'Pattern 1', sequence: Array(4).fill(null).map(() => ({ id: crypto.randomUUID(), chords: [null] })) }
  ]);
  const [activePatternIndex, setActivePatternIndex] = useState(0);
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
    sampleVolume,
    arpSettings
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
      sampleVolume,
      arpSettings
    };
  }); 

  const { isMetronomePlaying, bpm, setBpm, toggleMetronome, metronomeTick, beatInfo } = useMetronome({
    audioContext: audioEngineRef.current?.getAudioContext() ?? null,
  });

  // --- ARPEGGIATOR LOGIC ---
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
          settings.activeCategory
      );

      audioEngineRef.current.stopNote(note, settings.adsr.release, time + duration);
  }, []);

  // Combine all inputs for Arp: Pressed keys, MIDI, Sustained keys, Sequencer (Song Builder)
  const allHeldNotes = useMemo(() => {
      // We explicitly add `sustainedNotes.keys()` here to include notes held by pedal
      return new Set([...pressedNotes, ...midiPressedNotes, ...sustainedNotes.keys(), ...sequencerHeldNotes]);
  }, [pressedNotes, midiPressedNotes, sustainedNotes, sequencerHeldNotes]);

  useArpeggiator({
      bpm,
      settings: arpSettings,
      heldNotes: allHeldNotes,
      audioContext: audioEngineRef.current?.getAudioContext() ?? null,
      onPlayNote: handleArpPlayNote,
      octaveOffset: octaveOffset
  });

  const looperNoteOn = useCallback((note: string, time?: number) => {
    audioEngineRef.current?.playNote(note, synthSettingsRef.current.adsr, synthSettingsRef.current.osc1, synthSettingsRef.current.osc2, synthSettingsRef.current.oscMix, time, undefined, synthSettingsRef.current.activeCategory);
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
            audioEngineRef.current?.playNote(chordNote, settings.adsr, settings.osc1, settings.osc2, settings.oscMix, undefined, finalRootNote, settings.activeCategory);
            looperRecordNoteOn(chordNote);
        });
    } else {
        audioEngineRef.current.playNote(finalRootNote, settings.adsr, settings.osc1, settings.osc2, settings.oscMix, undefined, undefined, settings.activeCategory);
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


  // --- SONG BUILDER LOGIC ---

  // Song Pattern Management
  const handlePatternAdd = () => {
      setSongPatterns(prev => [
          ...prev,
          { 
              id: crypto.randomUUID(), 
              name: `Pattern ${prev.length + 1}`, 
              sequence: Array(4).fill(null).map(() => ({ id: crypto.randomUUID(), chords: [null] })) 
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
              
              // Default to Octave 4
              const rootNote = `${root}4`;
              
              // Get notes for absolute chord
              const notes = getChordNotes(rootNote, mode, { key: settings.musicKey, scale: settings.diatonicScale });
              
              setSequencerHeldNotes(new Set(notes));
              
              if (!settings.arpSettings.on) {
                  notes.forEach(n => {
                      audioEngineRef.current?.playNote(n, settings.adsr, settings.osc1, settings.osc2, settings.oscMix, undefined, undefined, settings.activeCategory);
                  });
              }
          }
      } else {
          // Parse Roman Numeral (Relative to Key)
          
          // Clean the numeral
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
                  audioEngineRef.current?.playNote(n, settings.adsr, settings.osc1, settings.osc2, settings.oscMix, undefined, undefined, settings.activeCategory);
              });
          }
      }
      
  }, []);
  
  const handleSongStopStep = useCallback((chordRoman: string) => {
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

  const { isPlaying: isSongPlaying, togglePlay: toggleSongPlay, currentMeasureIndex, stop: stopSong } = useSongPlayer({
      bpm,
      sequence: songPatterns[activePatternIndex].sequence,
      onPlayChord: handleSongPlayStep,
      onStopChord: handleSongStopStep,
      audioContext: audioEngineRef.current?.getAudioContext() ?? null,
      isMetronomeEnabled: songMetronomeOn
  });
  
  const handleSongClear = () => {
      stopSong();
      setSequencerHeldNotes(new Set());
      // Reset to default 1-slot measures
      handleSequenceChange(Array(4).fill(null).map(() => ({ id: crypto.randomUUID(), chords: [null] })));
  };


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
    }
    setIsInitialized(true);
  };
  
  const handleMidiConnect = useCallback(() => {
    if (!navigator.requestMIDIAccess) {
      setMidiDeviceName('Not Supported');
      return;
    }
    setMidiDeviceName('Connecting...');

    const onMIDIMessage = (event: MIDIMessageEvent) => {
        if (!audioEngineRef.current) return;
        
        const settings = synthSettingsRef.current;
        const [status, data1, data2] = event.data;
        const command = status >> 4;
        const noteNumber = data1;
        const velocity = data2;

        switch (command) {
            case 9: // Note On
                if (velocity > 0) {
                    const note = midiToNoteName(noteNumber);
                    
                    // Update MIDI State state
                    setMidiPressedNotes(prev => new Set(prev).add(note));
                    setMidiSustainedNotes(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(note);
                        return newSet;
                    });

                    // Play Logic
                    if (!settings.arpSettings.on) {
                        audioEngineRef.current.playNote(note, settings.adsr, settings.osc1, settings.osc2, settings.oscMix, undefined, undefined, settings.activeCategory);
                        looperRecordNoteOn(note);
                    }

                } else { // Note On with velocity 0 is a Note Off
                    const note = midiToNoteName(noteNumber);
                    
                    setMidiPressedNotes(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(note);
                        return newSet;
                    });

                    if (!settings.arpSettings.on) {
                        looperRecordNoteOff(note);
                        if (sustainOnRef.current) {
                            setMidiSustainedNotes(prev => new Set(prev).add(note));
                        } else {
                            audioEngineRef.current.stopNote(note, settings.adsr.release);
                        }
                    }
                }
                break;
            case 8: // Note Off
                const note = midiToNoteName(noteNumber);
                
                setMidiPressedNotes(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(note);
                    return newSet;
                });

                if (!settings.arpSettings.on) {
                    looperRecordNoteOff(note);
                    if (sustainOnRef.current) {
                        setMidiSustainedNotes(prev => new Set(prev).add(note));
                    } else {
                        audioEngineRef.current.stopNote(note, settings.adsr.release);
                    }
                }
                break;
            case 11: // Control Change
                if (data1 === 64) setSustainOn(data2 >= 64);
                break;
            case 14: // Pitch Bend
                const bendValue = ((data2 << 7) | data1) - 8192;
                setPitchBend((bendValue / 8192) * PITCH_BEND_AMOUNT);
                break;
        }
    };
    
    const onMIDISuccess = (midiAccess: MIDIAccess) => {
      const inputs = Array.from(midiAccess.inputs.values());
      if (inputs.length > 0) {
        setMidiDeviceName(inputs[0].name || 'Unknown Device');
        inputs.forEach(input => input.onmidimessage = onMIDIMessage);
      } else {
        setMidiDeviceName('No Devices Found');
      }

      midiAccess.onstatechange = (event: MIDIConnectionEvent) => {
        if (event.port.type === 'input') onMIDISuccess(midiAccess);
      };
    };

    navigator.requestMIDIAccess({ sysex: false }).then(onMIDISuccess, () => setMidiDeviceName('Access Denied'));
  
  }, [isInitialized, looperRecordNoteOn, looperRecordNoteOff]);

  useEffect(() => {
    audioEngineRef.current?.setPitchBend(pitchBend);
  }, [pitchBend]);

  useEffect(() => {
    audioEngineRef.current?.setAdaptiveTuning(adaptiveTuning);
  }, [adaptiveTuning, isInitialized]);
  
  useEffect(() => {
    if(audioEngineRef.current) {
        audioEngineRef.current.setMasterVolume(masterVolume);
    }
  }, [masterVolume, isInitialized]);

  // --- EFFECTS HOOKS ---
  useEffect(() => { audioEngineRef.current?.updateFilter(filterSettings); }, [filterSettings, isInitialized]);
  useEffect(() => { audioEngineRef.current?.updateDelay(delaySettings); }, [delaySettings, isInitialized]);
  useEffect(() => { audioEngineRef.current?.updateReverb(reverbSettings); }, [reverbSettings, isInitialized]);
  useEffect(() => { audioEngineRef.current?.updateSaturation(saturationSettings); }, [saturationSettings, isInitialized]);
  useEffect(() => { audioEngineRef.current?.updateChorus(chorusSettings); }, [chorusSettings, isInitialized]);
  useEffect(() => { audioEngineRef.current?.updatePhaser(phaserSettings); }, [phaserSettings, isInitialized]);
  useEffect(() => { audioEngineRef.current?.updateLFO(lfoSettings); }, [lfoSettings, isInitialized]);

  // Real-time frequency polling for Hz display mode
  useEffect(() => {
    if (!isInitialized || !audioEngineRef.current || keyboardDisplayMode !== 'hz') {
        if (noteFrequencies.size > 0) setNoteFrequencies(new Map()); // Clear if not needed
        return;
    };

    let animationFrameId: number;
    const audioEngine = audioEngineRef.current;

    const updateFrequencies = () => {
        const liveFrequencies = audioEngine.getLiveFrequencies();
        setNoteFrequencies(new Map(liveFrequencies)); // Create new map to ensure re-render
        animationFrameId = requestAnimationFrame(updateFrequencies);
    };

    animationFrameId = requestAnimationFrame(updateFrequencies);

    return () => {
        cancelAnimationFrame(animationFrameId);
    };
  }, [isInitialized, keyboardDisplayMode, noteFrequencies.size]);
  
  // --- SAMPLE HANDLING ---
  const handleSampleLoad = useCallback(async (arrayBuffer: ArrayBuffer) => {
      if (!audioEngineRef.current) return;
      try {
          const audioContext = audioEngineRef.current.getAudioContext();
          const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
          await audioEngineRef.current.setSample(decodedBuffer);
          setSampleBuffer(decodedBuffer);
      } catch (error) {
          console.error("Error decoding audio sample:", error);
      }
  }, []);
  
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
  const styleProps = {
      '--accent-500': currentTheme.primary,
      '--secondary-500': currentTheme.secondary,
      '--accent-400': currentTheme.primary, // Simplified for now
  } as React.CSSProperties;

  if (!isInitialized) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-synth-gray-900" style={styleProps}>
            <div className="text-center p-8 bg-synth-gray-800 rounded-lg shadow-xl">
                <h1 className="text-3xl font-bold text-white mb-2">ISL Synth</h1>
                <p className="text-lg text-synth-gray-500 mb-8">by Clark Lambert</p>
                <button 
                    onClick={handleInit} 
                    className="px-6 py-3 bg-synth-purple-500 text-white font-bold rounded-lg hover:bg-synth-purple-400 transition-colors focus:outline-none focus:ring-2 focus:ring-synth-cyan-500"
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
      <div className="w-full max-w-6xl mx-auto bg-synth-gray-900 shadow-2xl rounded-xl p-4 sm:p-6 lg:p-8 flex flex-col gap-8 transition-colors duration-500">
        <header className="flex justify-center items-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wider">
                ISL Synth
            </h1>
        </header>
        
        <main className="flex flex-col gap-8">
          <Controls 
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
          <Visualizer analyserX={audioEngineRef.current?.analyserX ?? null} />
          
           <div className="mt-4">
               <SequencerPanel
                    bpm={bpm}
                    onBpmChange={setBpm}
                    isMetronomePlaying={isMetronomePlaying}
                    onToggleMetronome={toggleMetronome}
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
                isPlaying={isSongPlaying}
                onPlayPause={toggleSongPlay}
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
                onConnectMidi={handleMidiConnect}
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
