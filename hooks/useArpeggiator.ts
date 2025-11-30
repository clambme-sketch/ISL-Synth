
import { useEffect, useRef, useCallback } from 'react';
import type { ArpeggiatorSettings } from '../types';
import { NOTE_NAME_TO_CHROMATIC_INDEX, normalizeNoteName } from '../services/musicTheory';

interface UseArpeggiatorProps {
    bpm: number;
    settings: ArpeggiatorSettings;
    heldNotes: Set<string>;
    audioContext: AudioContext | null;
    onPlayNote: (note: string, time: number, duration: number) => void;
    octaveOffset: number;
    isExternalClockActive?: boolean;
}

// Robust helper to parse note name to MIDI for sorting
const getMidiValue = (note: string): number => {
    // 1. Normalize note to ensure Sharps (e.g. Bb -> A#)
    const normalized = normalizeNoteName(note);
    
    // 2. Parse Normalized Note
    const match = normalized.match(/([A-G]#?)(-?\d+)/);
    if (!match) return 0;
    
    const noteName = match[1];
    const octave = parseInt(match[2], 10);
    
    const chroma = NOTE_NAME_TO_CHROMATIC_INDEX[noteName];
    if (chroma === undefined) return 0;

    return (octave + 1) * 12 + chroma;
};

const getNoteFromMidi = (midi: number): string => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const chroma = midi % 12;
    // Handle negative chromas wrapping correctly if that ever happens
    const safeChroma = (chroma + 12) % 12; 
    return `${notes[safeChroma]}${octave}`;
};


export const useArpeggiator = ({
    bpm,
    settings,
    heldNotes,
    audioContext,
    onPlayNote,
    octaveOffset,
    isExternalClockActive = false
}: UseArpeggiatorProps) => {
    const nextNoteTimeRef = useRef<number>(0);
    const stepIndexRef = useRef<number>(0);
    const timerRef = useRef<number | null>(null);
    
    // Use refs for mutable data to avoid stale closures
    const settingsRef = useRef(settings);
    const sortedNotesRef = useRef<string[]>([]);
    
    // Latch Logic Refs
    const latchedNotesRef = useRef<Set<string>>(new Set());
    const prevHeldSizeRef = useRef<number>(0);
    const releaseTimerRef = useRef<number | null>(null);
    const heldNotesRef = useRef<Set<string>>(new Set()); // Mirror of heldNotes for timer access
    
    // Ref to hold scheduler to avoid circular deps
    const internalSchedulerRef = useRef<() => void>(() => {});

    // Update settings ref
    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);
    
    useEffect(() => {
        heldNotesRef.current = heldNotes;
    }, [heldNotes]);

    // Helper: Sort and extend notes based on settings
    const processPattern = useCallback((notesSet: Set<string>) => {
        let notes = Array.from(notesSet);
        const currentSettings = settingsRef.current;

        if (notes.length === 0) {
            sortedNotesRef.current = [];
            return;
        }

        if (currentSettings.direction !== 'played' && currentSettings.direction !== 'random') {
            notes.sort((a, b) => getMidiValue(a) - getMidiValue(b));
        }

        let extendedNotes: string[] = [];
        for (let oct = 0; oct < currentSettings.range; oct++) {
            const octaveShifted = notes.map(note => {
                if (oct === 0) return note;
                const midi = getMidiValue(note);
                return getNoteFromMidi(midi + (oct * 12));
            });
            extendedNotes = [...extendedNotes, ...octaveShifted];
        }

        let finalPattern: string[] = [];
        if (currentSettings.direction === 'up' || currentSettings.direction === 'played') {
            finalPattern = extendedNotes;
        } else if (currentSettings.direction === 'down') {
            finalPattern = extendedNotes.reverse();
        } else if (currentSettings.direction === 'upDown') {
            finalPattern = [...extendedNotes, ...extendedNotes.slice(1, -1).reverse()];
        } else if (currentSettings.direction === 'random') {
            finalPattern = extendedNotes;
        }

        sortedNotesRef.current = finalPattern;
    }, []);

    // --- MAIN LATCH & NOTE LOGIC ---
    useEffect(() => {
        // Recalculate pattern whenever direction/range changes
        processPattern(latchedNotesRef.current);
    }, [settings.direction, settings.range, processPattern]);

    useEffect(() => {
        if (!settings.latch) {
            // Standard Mode: No latching, just play what is held
            if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
            latchedNotesRef.current = new Set(heldNotes);
            processPattern(heldNotes);
            if (heldNotes.size === 0) stepIndexRef.current = 0;
            return;
        }

        // --- SMART LATCH LOGIC ---
        const currentSize = heldNotes.size;
        const prevSize = prevHeldSizeRef.current;

        if (currentSize > 0 && currentSize >= prevSize) {
            // CASE 1: Adding notes or holding steady (0->1, 1->3, 3->3)
            // Immediate update. New chord or adding to chord.
            
            if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
            
            // If starting from 0, reset the step index for a fresh start
            if (prevSize === 0) stepIndexRef.current = 0;

            latchedNotesRef.current = new Set(heldNotes);
            processPattern(latchedNotesRef.current);
        
        } else if (currentSize < prevSize) {
            // CASE 2: Releasing notes (3->2, 2->0)
            // Don't update immediately. Wait for "Human Error" window.
            // This allows sloppy releases of chords without dropping notes instantly.
            
            if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);

            releaseTimerRef.current = window.setTimeout(() => {
                const currentRealtimeHeld = heldNotesRef.current;
                
                if (currentRealtimeHeld.size > 0) {
                    // User partially released and held there (e.g. lifting 1 finger).
                    // Update the latch to the new partial state.
                    latchedNotesRef.current = new Set(currentRealtimeHeld);
                    processPattern(latchedNotesRef.current);
                } else {
                    // User released EVERYTHING.
                    // Keep the previous latch state (Sustain the full chord).
                    // Do nothing here, preserving latchedNotesRef.
                }
            }, 150); // 150ms window for sloppy releases
        }

        prevHeldSizeRef.current = currentSize;

    }, [heldNotes, settings.latch, processPattern]);

    // --- CORE LOGIC: PLAY NEXT NOTE ---
    const playNextStep = useCallback((time: number, duration: number) => {
        const pattern = sortedNotesRef.current;
        const currentSettings = settingsRef.current;

        if (pattern.length > 0) {
            let noteToPlay = '';
            
            if (currentSettings.direction === 'random') {
                const randIdx = Math.floor(Math.random() * pattern.length);
                noteToPlay = pattern[randIdx];
            } else {
                noteToPlay = pattern[stepIndexRef.current % pattern.length];
            }
            
            // Transpose based on current keyboard octave shift
            const midi = getMidiValue(noteToPlay);
            const transposedNote = getNoteFromMidi(midi + (octaveOffset * 12));

            onPlayNote(transposedNote, time, duration);
        }

        stepIndexRef.current++;
    }, [octaveOffset, onPlayNote]);


    // --- MODE 1: INTERNAL SCHEDULER (Free Running) ---
    const internalScheduler = useCallback(() => {
        if (!audioContext || !settingsRef.current.on || isExternalClockActive) return;
        
        const currentSettings = settingsRef.current;
        const secondsPerBeat = 60.0 / bpm;
        
        let stepMultiplier = 1;
        switch (currentSettings.rate) {
            case '1/4': stepMultiplier = 1; break;
            case '1/8': stepMultiplier = 0.5; break;
            case '1/16': stepMultiplier = 0.25; break;
            case '1/32': stepMultiplier = 0.125; break;
        }
        const stepDuration = secondsPerBeat * stepMultiplier;
        const gateDuration = stepDuration * currentSettings.gate;

        const lookahead = 0.1; // 100ms lookahead

        while (nextNoteTimeRef.current < audioContext.currentTime + lookahead) {
            playNextStep(nextNoteTimeRef.current, gateDuration);
            nextNoteTimeRef.current += stepDuration;
        }

        timerRef.current = window.setTimeout(() => internalSchedulerRef.current(), 25);
    }, [audioContext, bpm, isExternalClockActive, playNextStep]);

    useEffect(() => {
        internalSchedulerRef.current = internalScheduler;
    }, [internalScheduler]);


    // --- MODE 2: EXTERNAL CLOCK HANDLER (Metronome Sync) ---
    // This is called by the parent's metronome scheduler at 16th note intervals
    const onExternalClockStep = useCallback((gridStep: number, time: number) => {
        if (!settingsRef.current.on || !sortedNotesRef.current.length) return;

        const rate = settingsRef.current.rate;
        const secondsPerBeat = 60.0 / bpm;
        
        if (rate === '1/32') {
            // Special handling for 32nd notes: Play two notes per 16th-note step
            const thirtySecondDuration = secondsPerBeat * 0.125;
            const gateDuration = thirtySecondDuration * settingsRef.current.gate;
            
            // Note 1: On grid
            playNextStep(time, gateDuration);
            
            // Note 2: Halfway to next 16th
            playNextStep(time + thirtySecondDuration, gateDuration);
            return;
        }

        let shouldPlay = false;
        let durationMultiplier = 0.25; // Default 16th note

        // GridStep is 0-15 (16th notes)
        if (rate === '1/16') {
            shouldPlay = true; // Play every 16th
            durationMultiplier = 0.25;
        } else if (rate === '1/8') {
            shouldPlay = gridStep % 2 === 0; // Play on 0, 2, 4...
            durationMultiplier = 0.5;
        } else if (rate === '1/4') {
            shouldPlay = gridStep % 4 === 0; // Play on 0, 4, 8...
            durationMultiplier = 1.0;
        }

        if (shouldPlay) {
            const stepDuration = secondsPerBeat * durationMultiplier;
            const gateDuration = stepDuration * settingsRef.current.gate;
            playNextStep(time, gateDuration);
        }
    }, [bpm, playNextStep]);


    // --- LIFECYCLE MANAGEMENT ---
    useEffect(() => {
        if (settings.on && audioContext) {
            if (!isExternalClockActive) {
                // START INTERNAL
                // Ensure we don't schedule in the past if restarting
                nextNoteTimeRef.current = Math.max(nextNoteTimeRef.current, audioContext.currentTime + 0.05);
                internalScheduler();
            } else {
                // STOP INTERNAL (External will drive it)
                if (timerRef.current) clearTimeout(timerRef.current);
            }
        } else {
            // STOP ALL
            if (timerRef.current) clearTimeout(timerRef.current);
            if (!settings.on) {
                latchedNotesRef.current.clear();
                sortedNotesRef.current = [];
            }
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [settings.on, audioContext, internalScheduler, isExternalClockActive]);

    return {
        onExternalClockStep
    };
};
