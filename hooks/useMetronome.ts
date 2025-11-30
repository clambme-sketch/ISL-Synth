
import { useState, useEffect, useRef, useCallback } from 'react';

const SCHEDULING_AHEAD_TIME = 0.1; // seconds
const TICK_LENGTH = 0.05; // seconds

interface UseMetronomeProps {
    audioContext: AudioContext | null;
    onStep?: (step: number, time: number) => void;
    muteClick?: boolean;
}

export interface BeatInfo {
    beat: 1 | 2 | 3 | 4;
    time: number;
    step: number; // 0-15
}

export const useMetronome = ({ audioContext, onStep, muteClick = false }: UseMetronomeProps) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(90);
    const [tick, setTick] = useState(false);
    // beatInfo for UI synchronization (legacy support)
    const [beatInfo, setBeatInfo] = useState<BeatInfo>({ beat: 4, time: 0, step: 15 });

    const timerRef = useRef<number | null>(null);
    const nextNoteTimeRef = useRef(0);
    const currentStepRef = useRef<number>(15);
    
    // Use a ref for onStep to avoid closure staleness in the scheduler loop
    const onStepRef = useRef(onStep);
    useEffect(() => { onStepRef.current = onStep; }, [onStep]);
    
    // Keep muteClick current in ref if needed inside callbacks, though checking prop directly in scheduleTick is usually fine if dependencies are right.
    const muteClickRef = useRef(muteClick);
    useEffect(() => { muteClickRef.current = muteClick; }, [muteClick]);
    
    const schedulerRef = useRef<() => void>(() => {});

    const scheduleTick = useCallback((step: number, time: number) => {
        if (!audioContext) return;

        // Calculate quarter note beat (1-4) from 16th note step (0-15)
        const beatIndex = Math.floor(step / 4); // 0, 1, 2, 3
        const isDownbeat = step % 4 === 0;
        
        // Update State for UI
        if (isDownbeat) {
            setBeatInfo({ beat: (beatIndex + 1) as 1|2|3|4, time, step });
            setTick(prev => !prev); // Toggle tick state for visual blink
        } else {
            // Keep step info updated even on off-beats if needed for visuals
            setBeatInfo(prev => ({ ...prev, step }));
        }
        
        // Play Metronome Click (Only on Quarter Notes AND if not muted)
        if (isDownbeat && !muteClickRef.current) {
            const isFirstBeat = step === 0;
            const clickOsc = audioContext.createOscillator();
            const clickGain = audioContext.createGain();

            clickOsc.frequency.setValueAtTime(isFirstBeat ? 1200 : 800, time);
            clickGain.gain.setValueAtTime(1, time);
            clickGain.gain.exponentialRampToValueAtTime(0.001, time + TICK_LENGTH);
            
            clickOsc.connect(clickGain).connect(audioContext.destination);
            clickOsc.start(time);
            clickOsc.stop(time + TICK_LENGTH);
        }
        
        // Trigger external callback (e.g., Drum Machine) for EVERY step
        if (onStepRef.current) {
            onStepRef.current(step, time);
        }

    }, [audioContext]);

    const scheduler = useCallback(() => {
        if (!audioContext) return;
        while (nextNoteTimeRef.current < audioContext.currentTime + SCHEDULING_AHEAD_TIME) {
            // Advance step
            const nextStep = (currentStepRef.current + 1) % 16;
            currentStepRef.current = nextStep;
            
            scheduleTick(nextStep, nextNoteTimeRef.current);
            
            // Calculate time for one 16th note
            const secondsPerBeat = 60.0 / bpm;
            const secondsPer16th = secondsPerBeat / 4;
            
            nextNoteTimeRef.current += secondsPer16th;
        }
        timerRef.current = window.setTimeout(() => schedulerRef.current(), 25);
    }, [audioContext, bpm, scheduleTick]);

    useEffect(() => {
        schedulerRef.current = scheduler;
    }, [scheduler]);

    const toggleMetronome = (syncTime?: number) => {
        if (!audioContext) return;
        
        const newIsPlaying = !isPlaying;
        setIsPlaying(newIsPlaying);

        if (newIsPlaying) {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            
            if (syncTime !== undefined) {
                // SYNC START logic (Complex for 16th notes, simplified here to nearest beat)
                const secondsPerBeat = 60.0 / bpm;
                const secondsPer16th = secondsPerBeat / 4;
                const currentTime = audioContext.currentTime;
                
                // Align to next 16th note grid relative to syncTime
                const timeSinceSync = currentTime - syncTime;
                const stepsElapsed = Math.floor(timeSinceSync / secondsPer16th);
                
                nextNoteTimeRef.current = syncTime + (stepsElapsed + 1) * secondsPer16th;
                currentStepRef.current = stepsElapsed % 16;
                
                setBeatInfo({ beat: (Math.floor(currentStepRef.current / 4) + 1) as 1|2|3|4, time: nextNoteTimeRef.current - secondsPer16th, step: currentStepRef.current });

            } else {
                // FRESH START
                nextNoteTimeRef.current = audioContext.currentTime;
                currentStepRef.current = 15; // Start before 0 so first tick is 0
                setBeatInfo({ beat: 4, time: audioContext.currentTime, step: 15 });
            }
            
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
        beatInfo,
        currentStep: beatInfo.step // Expose for UI highlighting
    };
};
