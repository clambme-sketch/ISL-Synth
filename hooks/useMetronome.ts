
import { useState, useEffect, useRef, useCallback } from 'react';

const SCHEDULING_AHEAD_TIME = 0.1; // seconds
const TICK_LENGTH = 0.05; // seconds

interface UseMetronomeProps {
    audioContext: AudioContext | null;
}

export interface BeatInfo {
    beat: 1 | 2 | 3 | 4;
    time: number;
}

export const useMetronome = ({ audioContext }: UseMetronomeProps) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(90);
    const [tick, setTick] = useState(false);
    const [beatInfo, setBeatInfo] = useState<BeatInfo>({ beat: 4, time: 0 });

    const timerRef = useRef<number | null>(null);
    const nextNoteTimeRef = useRef(0);
    const lastBeatRef = useRef<1 | 2 | 3 | 4>(4);
    
    const schedulerRef = useRef<() => void>(() => {});

    const scheduleTick = useCallback(() => {
        if (!audioContext) return;

        const nextBeat = (lastBeatRef.current % 4) + 1 as 1 | 2 | 3 | 4;
        lastBeatRef.current = nextBeat;
        setBeatInfo({ beat: nextBeat, time: nextNoteTimeRef.current });

        const clickOsc = audioContext.createOscillator();
        const clickGain = audioContext.createGain();

        clickOsc.frequency.setValueAtTime(nextBeat === 1 ? 1200 : 800, audioContext.currentTime);
        clickGain.gain.setValueAtTime(1, nextNoteTimeRef.current);
        clickGain.gain.exponentialRampToValueAtTime(0.001, nextNoteTimeRef.current + TICK_LENGTH);
        
        clickOsc.connect(clickGain).connect(audioContext.destination);
        clickOsc.start(nextNoteTimeRef.current);
        clickOsc.stop(nextNoteTimeRef.current + TICK_LENGTH);

        setTick(prev => !prev);
    }, [audioContext]);

    const scheduler = useCallback(() => {
        if (!audioContext) return;
        while (nextNoteTimeRef.current < audioContext.currentTime + SCHEDULING_AHEAD_TIME) {
            scheduleTick();
            const secondsPerBeat = 60.0 / bpm;
            nextNoteTimeRef.current += secondsPerBeat;
        }
        timerRef.current = window.setTimeout(() => schedulerRef.current(), 25);
    }, [audioContext, bpm, scheduleTick]);

    useEffect(() => {
        schedulerRef.current = scheduler;
    }, [scheduler]);

    const toggleMetronome = () => {
        if (!audioContext) return;
        
        const newIsPlaying = !isPlaying;
        setIsPlaying(newIsPlaying);

        if (newIsPlaying) {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            nextNoteTimeRef.current = audioContext.currentTime;
            lastBeatRef.current = 4;
            setBeatInfo({ beat: 4, time: audioContext.currentTime });
            scheduler();
        } else {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        }
    };
    
    useEffect(() => {
        if (!audioContext && isPlaying) {
            setIsPlaying(false);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        }
    }, [audioContext, isPlaying]);


    return {
        isMetronomePlaying: isPlaying,
        bpm,
        setBpm,
        toggleMetronome,
        metronomeTick: tick,
        beatInfo
    };
};
