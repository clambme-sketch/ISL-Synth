


import { useState, useRef, useEffect, useCallback } from 'react';
import type { LoopEvent } from '../types';
import type { BeatInfo } from './useMetronome';

interface UseLooperProps {
  bpm: number;
  bars: number;
  audioContext: AudioContext | null;
  isMetronomePlaying: boolean;
  beatInfo: BeatInfo;
  onPlayNote: (note: string, time: number) => void;
  onStopNote: (note: string, time: number) => void;
  onStopAllLoopNotes: () => void;
}

const BEATS_PER_BAR = 4;
const SCHEDULING_WINDOW = 0.1; // seconds lookahead
const MAX_LATENESS_WINDOW = 0.2; // seconds tolerance for playing late notes

// A temporary event format for raw recording before processing
type TimedLoopEvent = { note: string; time: number; type: 'on' | 'off' };

export const useLooper = ({ bpm, bars, audioContext, isMetronomePlaying, beatInfo, onPlayNote, onStopNote, onStopAllLoopNotes }: UseLooperProps) => {
  // Multi-slot State
  const [loops, setLoops] = useState<Record<string, LoopEvent[]>>({ A: [], B: [], C: [], D: [] });
  const [activeSlot, setActiveSlot] = useState('A');
  const [queuedSlot, setQueuedSlot] = useState<string | null>(null);

  const [loopState, setLoopState] = useState<'idle' | 'countingIn' | 'recording' | 'playing' | 'overdubbing'>('idle');
  const [progress, setProgress] = useState(0);
  const [countInMeasure, setCountInMeasure] = useState(0);

  // --- REFS ---
  const schedulerFrameRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingStopTimeRef = useRef<number>(0);
  const loopPlaybackStartTimeRef = useRef<number>(0);

  const timedEventsRef = useRef<TimedLoopEvent[]>([]);
  
  const waitingForDownbeatRef = useRef(false);
  const nextEventIndexRef = useRef(0);
  const lastProgressRef = useRef(0);
  const countInMeasuresRemainingRef = useRef(0);
  
  // Refs for scheduler access
  const activeSlotRef = useRef('A');
  const queuedSlotRef = useRef<string | null>(null);
  const loopsRef = useRef(loops); // Sync for scheduler

  useEffect(() => { loopsRef.current = loops; }, [loops]);
  useEffect(() => { activeSlotRef.current = activeSlot; }, [activeSlot]);
  useEffect(() => { queuedSlotRef.current = queuedSlot; }, [queuedSlot]);

  const loopDuration = (60 / bpm) * BEATS_PER_BAR * bars;

  const stopRecording = useCallback((preciseStopTime?: number) => {
    if (!audioContext || (loopState !== 'recording' && loopState !== 'overdubbing')) {
        return;
    }
    
    // Get existing events for Overdub, or empty for new Record
    const currentEvents = loopsRef.current[activeSlotRef.current] || [];
    const baseLoop = loopState === 'overdubbing' ? currentEvents : [];
    
    const newLoopEvents: LoopEvent[] = [];
    const noteStartTimes = new Map<string, number>();

    // Sort events by time to process in order
    timedEventsRef.current.sort((a, b) => a.time - b.time);

    for (const event of timedEventsRef.current) {
        let eventTime = event.time;
        
        // Wrap-Around Logic for Pickup Notes
        if (eventTime < 0) {
             // If note was played early (pickup), wrap it to the end of the loop
             eventTime = loopDuration + eventTime; 
        } else if (eventTime > loopDuration) {
             eventTime = eventTime % loopDuration; // Wrap overshoot
        }

        if (event.type === 'on') {
            if (noteStartTimes.has(event.note)) {
                // Previous note wasn't turned off, close it at current time
                const startTime = noteStartTimes.get(event.note)!;
                // Handle wrap-around duration calculation
                let duration = eventTime - startTime;
                if (duration < 0) duration += loopDuration;

                if (duration > 0.05) { 
                    newLoopEvents.push({ note: event.note, startTime, duration });
                }
            }
            noteStartTimes.set(event.note, eventTime);
        } else if (event.type === 'off') {
            if (noteStartTimes.has(event.note)) {
                const startTime = noteStartTimes.get(event.note)!;
                let duration = eventTime - startTime;
                if (duration < 0) duration += loopDuration;

                if (duration > 0.05) { 
                    newLoopEvents.push({ note: event.note, startTime, duration });
                }
                noteStartTimes.delete(event.note);
            }
        }
    }

    // Close any notes that were still on at the end of recording
    noteStartTimes.forEach((startTime, note) => {
        // If still on, it wraps to the start. effectively duration is rest of loop? 
        // Or simpler: cut at end of loop.
        const duration = loopDuration - startTime;
        if (duration > 0.05) { 
            newLoopEvents.push({ note, startTime, duration });
        }
    });
      
    const finalLoop = [...baseLoop, ...newLoopEvents].sort((a, b) => a.startTime - b.startTime);

    // Save to the ACTIVE SLOT
    const slot = activeSlotRef.current;
    setLoops(prev => ({ ...prev, [slot]: finalLoop }));

    timedEventsRef.current = [];
    setCountInMeasure(0);
    
    if (finalLoop.length > 0) {
        // Seamless transition setup:
        loopPlaybackStartTimeRef.current = recordingStartTimeRef.current;
        
        const effectiveEndTime = preciseStopTime ?? audioContext.currentTime;
        const timeSinceStart = effectiveEndTime - loopPlaybackStartTimeRef.current;
        
        lastProgressRef.current = timeSinceStart % loopDuration;
        
        nextEventIndexRef.current = 0;
        while (nextEventIndexRef.current < finalLoop.length && finalLoop[nextEventIndexRef.current].startTime < lastProgressRef.current) {
            nextEventIndexRef.current++;
        }

        setLoopState('playing');
    } else {
        setLoopState('idle');
        setProgress(0);
        lastProgressRef.current = 0;
    }
  }, [audioContext, loopState, loopDuration]);

  // Handle Metronome "Tick" Messages for Count-In
  useEffect(() => {
    const { beat, time } = beatInfo;
    if (loopState !== 'countingIn' || !waitingForDownbeatRef.current || beat !== 1 || !audioContext) {
        return;
    }

    if (countInMeasuresRemainingRef.current > 1) {
        countInMeasuresRemainingRef.current -= 1;
        setCountInMeasure(prev => prev + 1);
    } else {
        // Start Recording on this Downbeat
        const startTime = time;
        recordingStartTimeRef.current = startTime;
        recordingStopTimeRef.current = startTime + loopDuration;
        
        // Prepare for immediate playback/overdub references
        loopPlaybackStartTimeRef.current = startTime;
        
        const hasExisting = loopsRef.current[activeSlotRef.current].length > 0;
        const nextState = hasExisting ? 'overdubbing' : 'recording';
        
        setLoopState(nextState);
        waitingForDownbeatRef.current = false;
        setCountInMeasure(0);
        
        // Clear events buffer for the new take
        timedEventsRef.current = [];
    }
  }, [beatInfo, loopState, audioContext, loopDuration]);

  // Main Scheduler Loop
  useEffect(() => {
    if (loopState === 'idle' || loopState === 'countingIn' || !audioContext) {
        cancelAnimationFrame(schedulerFrameRef.current);
        if (loopState === 'idle') setProgress(0);
        return;
    }

    const scheduler = () => {
        const currentTime = audioContext.currentTime;

        // 1. Check for Recording End
        if ((loopState === 'recording' || loopState === 'overdubbing')) {
             if (currentTime >= recordingStopTimeRef.current) {
                stopRecording(recordingStopTimeRef.current);
                return; // Stop this frame, state change will trigger re-effect
             }
        }
        
        // 2. Playback Scheduling
        if (loopState === 'playing' || loopState === 'overdubbing') {
            const currentLoopEvents = loopsRef.current[activeSlotRef.current] || [];
            
            const timeIntoPlayback = currentTime - loopPlaybackStartTimeRef.current;
            const currentLoopProgress = timeIntoPlayback % loopDuration;

            // Detect loop wrap-around (End of Bar)
            if (currentLoopProgress < lastProgressRef.current) {
                // LOOP BOUNDARY CROSSED
                
                // Handle Slot Switching Queue
                if (queuedSlotRef.current) {
                    const nextSlot = queuedSlotRef.current;
                    setActiveSlot(nextSlot);
                    setQueuedSlot(null);
                    
                    // If next slot is empty, we keep playing silence (or could stop)
                    // If next slot has notes, they will be picked up by the nextEventIndex reset below
                    // NOTE: React state update is async, but refs are updated via useEffect. 
                    // However, we need instant switch for audio.
                    // We rely on 'activeSlot' state update to trigger re-render of scheduler, 
                    // BUT for this frame, we force the update:
                    activeSlotRef.current = nextSlot;
                }

                nextEventIndexRef.current = 0;
            }
            lastProgressRef.current = currentLoopProgress;

            // Schedule events for the CURRENT active slot
            const activeEvents = loopsRef.current[activeSlotRef.current] || [];
            
            while (nextEventIndexRef.current < activeEvents.length) {
                const event = activeEvents[nextEventIndexRef.current];
                
                // Calculate when this note should play relative to NOW
                let timeUntilEvent = event.startTime - currentLoopProgress;
                
                // Wrap-around logic for lookahead
                if (timeUntilEvent < -0.05 && (loopDuration - currentLoopProgress) < 0.1) {
                     timeUntilEvent += loopDuration;
                }
                
                const absoluteEventTime = currentTime + timeUntilEvent;

                if (absoluteEventTime < currentTime + SCHEDULING_WINDOW) {
                    
                    if (absoluteEventTime >= currentTime - MAX_LATENESS_WINDOW) {
                        const playTime = Math.max(currentTime, absoluteEventTime);
                        onPlayNote(event.note, playTime);
                        onStopNote(event.note, playTime + event.duration);
                    }
                    
                    nextEventIndexRef.current++;
                } else {
                    break;
                }
            }
            
            setProgress(currentLoopProgress / loopDuration);
        
        } else if (loopState === 'recording' || loopState === 'overdubbing') {
             const elapsed = currentTime - recordingStartTimeRef.current;
             setProgress(Math.min(1, elapsed / loopDuration));
        }

        schedulerFrameRef.current = requestAnimationFrame(scheduler);
    };

    schedulerFrameRef.current = requestAnimationFrame(scheduler);

    return () => {
        cancelAnimationFrame(schedulerFrameRef.current);
    };
  }, [loopState, audioContext, loopDuration, onPlayNote, onStopNote, stopRecording]); // removed 'loop' dependency, using refs

  // Input Handlers
  const noteOn = useCallback((note: string) => {
      if (!audioContext || (loopState !== 'recording' && loopState !== 'overdubbing')) return;
      timedEventsRef.current.push({
          note,
          time: audioContext.currentTime - recordingStartTimeRef.current,
          type: 'on',
      });
  }, [audioContext, loopState]);

  const noteOff = useCallback((note: string) => {
    if (!audioContext || (loopState !== 'recording' && loopState !== 'overdubbing')) return;
    timedEventsRef.current.push({
        note,
        time: audioContext.currentTime - recordingStartTimeRef.current,
        type: 'off',
    });
  }, [audioContext, loopState]);
  
  // Control Functions
  const startRecording = () => {
    if (!isMetronomePlaying || !audioContext) return;

    if (loopState === 'recording' || loopState === 'overdubbing') {
      stopRecording();
      return;
    }

    // If IDLE, we prep for count-in
    if (loopState === 'idle') {
      // Don't clear loop here, user might want to overdub on existing slot
      timedEventsRef.current = [];
    }
    
    setLoopState('countingIn');
    countInMeasuresRemainingRef.current = 1; 
    setCountInMeasure(1);
    waitingForDownbeatRef.current = true;
  };

  const togglePlayback = () => {
      if (!audioContext) return;

      if (loopState === 'playing' || loopState === 'overdubbing') {
          setLoopState('idle');
          setCountInMeasure(0);
          onStopAllLoopNotes();
          setProgress(0);
      } else {
          // Check if active slot has data
          const hasData = loops[activeSlot].length > 0;
          if (hasData) {
              if (audioContext.state === 'suspended') audioContext.resume();
              loopPlaybackStartTimeRef.current = audioContext.currentTime;
              nextEventIndexRef.current = 0;
              lastProgressRef.current = 0;
              setLoopState('playing');
          } else {
              // If empty, maybe start recording directly? 
              // For now, do nothing if empty to avoid confusion
          }
      }
  };

  const clearLoop = () => {
      if (loopState !== 'idle') {
          onStopAllLoopNotes();
      }
      // Clear ONLY the active slot
      setLoops(prev => ({ ...prev, [activeSlot]: [] }));
      
      setLoopState('idle');
      setCountInMeasure(0);
      timedEventsRef.current = [];
      lastProgressRef.current = 0;
      setProgress(0);
  };

  const switchSlot = (slot: string) => {
      if (loopState === 'playing' || loopState === 'overdubbing') {
          setQueuedSlot(slot);
      } else {
          setActiveSlot(slot);
          setQueuedSlot(null);
          // If idle, we just switch. Visuals update immediately.
      }
  }

  return {
    loopState,
    loop: loops[activeSlot], // Legacy support for single loop view
    loops,
    activeSlot,
    queuedSlot,
    switchSlot,
    progress,
    startRecording,
    togglePlayback,
    clearLoop,
    noteOn,
    noteOff,
    countInMeasure,
    playbackStartTime: loopPlaybackStartTimeRef.current 
  };
};
