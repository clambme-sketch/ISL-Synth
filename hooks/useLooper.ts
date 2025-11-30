
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
  const [loopState, setLoopState] = useState<'idle' | 'countingIn' | 'recording' | 'playing' | 'overdubbing'>('idle');
  const [loop, setLoop] = useState<LoopEvent[]>([]);
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
  
  const loopDuration = (60 / bpm) * BEATS_PER_BAR * bars;

  const stopRecording = useCallback((preciseStopTime?: number) => {
    if (!audioContext || (loopState !== 'recording' && loopState !== 'overdubbing')) {
        return;
    }
    
    const baseLoop = loopState === 'overdubbing' ? loop : [];
    
    const newLoopEvents: LoopEvent[] = [];
    const noteStartTimes = new Map<string, number>();

    // Sort events by time to process in order
    timedEventsRef.current.sort((a, b) => a.time - b.time);

    for (const event of timedEventsRef.current) {
        // Allow negative times up to -0.2s (metronome lookahead) and wrap them to end of loop if needed,
        // or clamp them to 0.0 if they are just slightly early downbeats.
        let eventTime = event.time;
        
        if (eventTime < 0) {
             // If extremely early, it might be a late hit for the previous bar, but here we assume it's the downbeat.
             // We clamp to 0 for simplicity, or we could wrap to loopDuration - abs(time) if we wanted to support pickup notes.
             // Clamping to 0 is safer for loop integrity.
             eventTime = 0;
        } else if (eventTime > loopDuration) {
             // If slightly past loop end, clamp or wrap.
             eventTime = Math.min(eventTime, loopDuration - 0.001);
        }

        if (event.type === 'on') {
            if (noteStartTimes.has(event.note)) {
                // Previous note wasn't turned off, close it at current time
                const startTime = noteStartTimes.get(event.note)!;
                const duration = eventTime - startTime;
                if (duration > 0.05) { // Minimum duration check to prevent glitches
                    newLoopEvents.push({ note: event.note, startTime, duration });
                }
            }
            noteStartTimes.set(event.note, eventTime);
        } else if (event.type === 'off') {
            if (noteStartTimes.has(event.note)) {
                const startTime = noteStartTimes.get(event.note)!;
                const duration = eventTime - startTime;
                if (duration > 0.05) { // Minimum duration check
                    newLoopEvents.push({ note: event.note, startTime, duration });
                }
                noteStartTimes.delete(event.note);
            }
        }
    }

    // Close any notes that were still on at the end of recording
    noteStartTimes.forEach((startTime, note) => {
        const duration = loopDuration - startTime;
        if (duration > 0.05) { // Minimum duration check
            newLoopEvents.push({ note, startTime, duration });
        }
    });
      
    const finalLoop = [...baseLoop, ...newLoopEvents]
        .sort((a, b) => a.startTime - b.startTime);

    timedEventsRef.current = [];
    setCountInMeasure(0);
    
    if (finalLoop.length > 0) {
        setLoop(finalLoop);
        
        // Seamless transition setup:
        // We anchor the playback start time to the original recording start time.
        // This ensures the loop phase remains perfectly consistent.
        loopPlaybackStartTimeRef.current = recordingStartTimeRef.current;
        
        // Determine where we are in the loop right now
        const effectiveEndTime = preciseStopTime ?? audioContext.currentTime;
        const timeSinceStart = effectiveEndTime - loopPlaybackStartTimeRef.current;
        
        // Update state refs for the scheduler
        lastProgressRef.current = timeSinceStart % loopDuration;
        
        // Advance the event index to match current progress so we don't replay the whole loop instantly
        nextEventIndexRef.current = 0;
        while (nextEventIndexRef.current < finalLoop.length && finalLoop[nextEventIndexRef.current].startTime < lastProgressRef.current) {
            nextEventIndexRef.current++;
        }

        setLoopState('playing');
    } else {
        setLoop([]);
        setLoopState('idle');
        setProgress(0);
        lastProgressRef.current = 0;
    }
  }, [audioContext, loopState, loopDuration, loop]);

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
        
        const nextState = loop.length > 0 ? 'overdubbing' : 'recording';
        setLoopState(nextState);
        waitingForDownbeatRef.current = false;
        setCountInMeasure(0);
        
        // Clear events buffer for the new take
        timedEventsRef.current = [];
    }
  }, [beatInfo, loopState, audioContext, loop.length, loopDuration]);

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
        if ((loopState === 'playing' || loopState === 'overdubbing') && loop.length > 0) {
            const timeIntoPlayback = currentTime - loopPlaybackStartTimeRef.current;
            const currentLoopProgress = timeIntoPlayback % loopDuration;

            // Detect loop wrap-around
            if (currentLoopProgress < lastProgressRef.current) {
                nextEventIndexRef.current = 0;
            }
            lastProgressRef.current = currentLoopProgress;

            // Schedule events
            while (nextEventIndexRef.current < loop.length) {
                const event = loop[nextEventIndexRef.current];
                
                // Calculate when this note should play relative to NOW
                let timeUntilEvent = event.startTime - currentLoopProgress;
                
                // Handle edge case where event is at start (0.0) and we are at end (e.g. 3.99)
                if (timeUntilEvent < -0.05 && (loopDuration - currentLoopProgress) < 0.1) {
                     timeUntilEvent += loopDuration;
                }
                
                const absoluteEventTime = currentTime + timeUntilEvent;

                // If the event is within our scheduling window...
                if (absoluteEventTime < currentTime + SCHEDULING_WINDOW) {
                    
                    // PLAY NOTE
                    // If we missed the exact time slightly (lag), play it NOW (Math.max).
                    // But if it's ancient history (> MAX_LATENESS_WINDOW), skip it to avoid bursts.
                    if (absoluteEventTime >= currentTime - MAX_LATENESS_WINDOW) {
                        const playTime = Math.max(currentTime, absoluteEventTime);
                        onPlayNote(event.note, playTime);
                        onStopNote(event.note, playTime + event.duration);
                    }
                    
                    nextEventIndexRef.current++;
                } else {
                    // Events are sorted, so if this one is too far in future, subsequent ones are too.
                    break;
                }
            }
            
            setProgress(currentLoopProgress / loopDuration);
        
        } else if (loopState === 'recording' || loopState === 'overdubbing') {
             // Just update UI progress during recording
             const elapsed = currentTime - recordingStartTimeRef.current;
             setProgress(Math.min(1, elapsed / loopDuration));
        }

        schedulerFrameRef.current = requestAnimationFrame(scheduler);
    };

    schedulerFrameRef.current = requestAnimationFrame(scheduler);

    return () => {
        cancelAnimationFrame(schedulerFrameRef.current);
    };
  }, [loopState, audioContext, loop, loopDuration, onPlayNote, onStopNote, stopRecording]);

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

    if (loopState === 'idle') {
      setLoop([]);
      timedEventsRef.current = [];
    }
    
    setLoopState('countingIn');
    countInMeasuresRemainingRef.current = 1; // 1 Bar count-in
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
      } else if (loop.length > 0) {
          // Restart loop from the beginning
          if (audioContext.state === 'suspended') audioContext.resume();
          
          loopPlaybackStartTimeRef.current = audioContext.currentTime;
          nextEventIndexRef.current = 0;
          lastProgressRef.current = 0;
          setLoopState('playing');
      }
  };

  const clearLoop = () => {
      if (loopState !== 'idle') {
          onStopAllLoopNotes();
      }
      setLoopState('idle');
      setCountInMeasure(0);
      setLoop([]);
      timedEventsRef.current = [];
      lastProgressRef.current = 0;
      setProgress(0);
  };

  return {
    loopState,
    loop,
    progress,
    startRecording,
    togglePlayback,
    clearLoop,
    noteOn,
    noteOff,
    countInMeasure,
    playbackStartTime: loopPlaybackStartTimeRef.current // Exposed for external sync
  };
};
