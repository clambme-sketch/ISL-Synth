
import { useEffect, useRef, useCallback } from 'react';
import type { ArpeggiatorSettings } from '../types';
import { NOTE_NAME_TO_CHROMATIC_INDEX } from '../services/musicTheory';

interface UseArpeggiatorProps {
    bpm: number;
    settings: ArpeggiatorSettings;
    heldNotes: Set<string>;
    audioContext: AudioContext | null;
    onPlayNote: (note: string, time: number, duration: number) => void;
    octaveOffset: number;
}

// Helper to parse note name to MIDI for sorting
const getMidiValue = (note: string): number => {
    const match = note.match(/([A-G]#?)(-?\d+)/);
    if (!match) return 0;
    const chroma = NOTE_NAME_TO_CHROMATIC_INDEX[match[1]];
    const octave = parseInt(match[2], 10);
    return (octave + 1) * 12 + chroma;
};

const getNoteFromMidi = (midi: number): string => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const chroma = midi % 12;
    return `${notes[chroma]}${octave}`;
};


export const useArpeggiator = ({
    bpm,
    settings,
    heldNotes,
    audioContext,
    onPlayNote,
    octaveOffset
}: UseArpeggiatorProps) => {
    const nextNoteTimeRef = useRef<number>(0);
    const stepIndexRef = useRef<number>(0);
    const timerRef = useRef<number | null>(null);
    
    // Use refs for mutable data to avoid stale closures
    const settingsRef = useRef(settings);
    const sortedNotesRef = useRef<string[]>([]);
    const latchedNotesRef = useRef<Set<string>>(new Set());
    
    // Ref to hold scheduler to avoid circular deps
    const schedulerRef = useRef<() => void>(() => {});

    // Update settings ref
    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    // Handle Note Logic (Sorting + Standard Latching)
    useEffect(() => {
        const isLatchOn = settings.latch;
        const currentHeld = heldNotes;
        
        let notesToPlay: Set<string>;

        if (isLatchOn) {
            if (currentHeld.size > 0) {
                latchedNotesRef.current = new Set(currentHeld);
                notesToPlay = currentHeld;
            } else {
                notesToPlay = latchedNotesRef.current;
            }
        } else {
            latchedNotesRef.current.clear();
            notesToPlay = currentHeld;
        }

        if (notesToPlay.size === 0) {
            sortedNotesRef.current = [];
            return;
        }

        let notes = Array.from(notesToPlay);
        if (settings.direction !== 'played' && settings.direction !== 'random') {
            notes.sort((a, b) => getMidiValue(a) - getMidiValue(b));
        }

        let extendedNotes: string[] = [];
        for (let oct = 0; oct < settings.range; oct++) {
            const octaveShifted = notes.map(note => {
                if (oct === 0) return note;
                const midi = getMidiValue(note);
                return getNoteFromMidi(midi + (oct * 12));
            });
            extendedNotes = [...extendedNotes, ...octaveShifted];
        }

        let finalPattern: string[] = [];
        if (settings.direction === 'up' || settings.direction === 'played') {
            finalPattern = extendedNotes;
        } else if (settings.direction === 'down') {
            finalPattern = extendedNotes.reverse();
        } else if (settings.direction === 'upDown') {
            finalPattern = [...extendedNotes, ...extendedNotes.slice(1, -1).reverse()];
        } else if (settings.direction === 'random') {
            finalPattern = extendedNotes;
        }

        sortedNotesRef.current = finalPattern;

    }, [heldNotes, settings.direction, settings.range, settings.latch]);

    // Define scheduler
    const scheduler = useCallback(() => {
        if (!audioContext || !settingsRef.current.on) return;
        
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
            const pattern = sortedNotesRef.current;
            
            if (pattern.length > 0) {
                let noteToPlay = '';
                
                if (currentSettings.direction === 'random') {
                    const randIdx = Math.floor(Math.random() * pattern.length);
                    noteToPlay = pattern[randIdx];
                } else {
                    noteToPlay = pattern[stepIndexRef.current % pattern.length];
                }
                
                const midi = getMidiValue(noteToPlay);
                const transposedNote = getNoteFromMidi(midi + (octaveOffset * 12));

                onPlayNote(transposedNote, nextNoteTimeRef.current, gateDuration);
            }

            stepIndexRef.current++;
            nextNoteTimeRef.current += stepDuration;
        }

        timerRef.current = window.setTimeout(() => schedulerRef.current(), 25);
    }, [audioContext, bpm, octaveOffset, onPlayNote]);

    useEffect(() => {
        schedulerRef.current = scheduler;
    }, [scheduler]);

    // Start/Stop Scheduler
    useEffect(() => {
        if (settings.on && audioContext) {
            nextNoteTimeRef.current = Math.max(nextNoteTimeRef.current, audioContext.currentTime + 0.05);
            scheduler();
        } else {
            if (timerRef.current) clearTimeout(timerRef.current);
            latchedNotesRef.current.clear();
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [settings.on, audioContext, scheduler]);
};
