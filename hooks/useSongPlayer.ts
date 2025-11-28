
import { useState, useEffect, useRef, useCallback } from 'react';
import type { SongMeasure } from '../types';

interface UseSongPlayerProps {
    bpm: number;
    sequence: SongMeasure[];
    onPlayChord: (chordName: string) => void;
    onStopChord: (chordName: string) => void;
    audioContext: AudioContext | null;
    isMetronomeEnabled: boolean;
}

const BEATS_PER_MEASURE = 4;
const GATE_RATIO = 0.95; // Chords play for 95% of the slot duration

export const useSongPlayer = ({ bpm, sequence, onPlayChord, onStopChord, audioContext, isMetronomeEnabled }: UseSongPlayerProps) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentMeasureIndex, setCurrentMeasureIndex] = useState(-1);
    
    // Refs for props to avoid stale closures in the recursive setTimeout loop
    const bpmRef = useRef(bpm);
    const sequenceRef = useRef(sequence);
    const isMetronomeEnabledRef = useRef(isMetronomeEnabled);
    const onPlayChordRef = useRef(onPlayChord);
    const onStopChordRef = useRef(onStopChord);
    const audioContextRef = useRef(audioContext);

    // State refs for the loop
    const timerRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const activeChordKeyRef = useRef<string | null>(null);
    const activeChordRef = useRef<string | null>(null);
    const lastBeatIntegerRef = useRef<number>(-1);

    // Keep refs updated
    useEffect(() => { bpmRef.current = bpm; }, [bpm]);
    useEffect(() => { sequenceRef.current = sequence; }, [sequence]);
    useEffect(() => { isMetronomeEnabledRef.current = isMetronomeEnabled; }, [isMetronomeEnabled]);
    useEffect(() => { onPlayChordRef.current = onPlayChord; }, [onPlayChord]);
    useEffect(() => { onStopChordRef.current = onStopChord; }, [onStopChord]);
    useEffect(() => { audioContextRef.current = audioContext; }, [audioContext]);

    const cleanup = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (activeChordRef.current) {
            onStopChordRef.current(activeChordRef.current);
            activeChordRef.current = null;
        }
        activeChordKeyRef.current = null;
        setCurrentMeasureIndex(-1);
        lastBeatIntegerRef.current = -1;
    }, []);

    const playClick = useCallback((high: boolean) => {
        const ctx = audioContextRef.current;
        if (!ctx) return;
        
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.frequency.setValueAtTime(high ? 1200 : 800, t);
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(t);
        osc.stop(t + 0.05);
    }, []);

    const schedule = useCallback(() => {
        const currentBpm = bpmRef.current;
        const currentSequence = sequenceRef.current;
        
        if (currentSequence.length === 0) return;

        const secondsPerBeat = 60 / currentBpm;
        const totalBeats = currentSequence.length * BEATS_PER_MEASURE; 
        const totalDurationMs = totalBeats * secondsPerBeat * 1000;
        
        const now = performance.now();
        const elapsed = now - startTimeRef.current;
        const effectiveElapsed = elapsed % totalDurationMs;
        
        const beatInSequence = (effectiveElapsed / 1000) / secondsPerBeat;
        const currentBeatInteger = Math.floor(beatInSequence);

        // Handle Loop Wrap
        if (currentBeatInteger < lastBeatIntegerRef.current) {
            lastBeatIntegerRef.current = -1;
        }

        // Trigger Metronome if enabled
        if (currentBeatInteger > lastBeatIntegerRef.current) {
             if (isMetronomeEnabledRef.current) {
                 const isDownbeat = currentBeatInteger % BEATS_PER_MEASURE === 0;
                 playClick(isDownbeat);
             }
             lastBeatIntegerRef.current = currentBeatInteger;
        }
        
        const measureIndex = Math.floor(beatInSequence / BEATS_PER_MEASURE) % currentSequence.length;
        const beatInMeasure = beatInSequence % BEATS_PER_MEASURE;
        
        const measure = currentSequence[measureIndex];
        
        const numSlots = measure.chords.length;
        const beatsPerSlot = BEATS_PER_MEASURE / numSlots;
        const slotIndex = Math.floor(beatInMeasure / beatsPerSlot);
        
        const beatWithinSlot = beatInMeasure % beatsPerSlot;
        const slotProgress = beatWithinSlot / beatsPerSlot;
        
        const positionKey = `${measureIndex}-${slotIndex}`;
        
        // GAP LOGIC: Stop chord early to create articulation
        if (slotProgress > GATE_RATIO) {
            if (activeChordRef.current) {
                onStopChordRef.current(activeChordRef.current);
                activeChordRef.current = null;
            }
        } else {
            if (positionKey !== activeChordKeyRef.current) {
                const nextChord = measure.chords[slotIndex];
                
                // Stop previous chord
                if (activeChordRef.current) {
                    onStopChordRef.current(activeChordRef.current);
                    activeChordRef.current = null;
                }
                
                // Play new chord
                if (nextChord) {
                    onPlayChordRef.current(nextChord);
                    activeChordRef.current = nextChord;
                }
                
                activeChordKeyRef.current = positionKey;
                setCurrentMeasureIndex(prev => (prev !== measureIndex ? measureIndex : prev));
            }
        }

        timerRef.current = window.setTimeout(schedule, 15);
    }, [playClick]);

    const togglePlay = useCallback(() => {
        setIsPlaying(prev => {
            if (prev) {
                cleanup();
                return false;
            } else {
                if (audioContextRef.current?.state === 'suspended') {
                    audioContextRef.current.resume();
                }
                startTimeRef.current = performance.now();
                lastBeatIntegerRef.current = -1;
                schedule();
                return true;
            }
        });
    }, [cleanup, schedule]);

    // Reset playback if sequence structure changes or BPM changes
    useEffect(() => {
        // Safe reset without reading 'isPlaying' to avoid linter dependency issues
        cleanup();
        setIsPlaying(false);
    }, [bpm, sequence, cleanup]); 

    // Cleanup on unmount
    useEffect(() => {
        return () => cleanup();
    }, [cleanup]);

    return {
        isPlaying,
        togglePlay,
        currentMeasureIndex,
        stop: () => { setIsPlaying(false); cleanup(); }
    };
};
