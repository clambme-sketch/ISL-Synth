import { useState, useRef, useEffect, useCallback } from 'react';
import type { LoopEvent } from '../types';

interface UseLooperProps {
  bpm: number;
  bars: number;
  audioContext: AudioContext | null;
  isMetronomePlaying: boolean;
  currentBeat: 1 | 2 | 3 | 4;
  onPlayNote: (note: string, time: number) => void;
  onStopNote: (note: string, time: number) => void;
  onStopAllLoopNotes: () => void;
}

const BEATS_PER_BAR = 4;
const SCHEDULING_WINDOW = 0.1; // seconds

export const useLooper = ({ bpm, bars, audioContext, isMetronomePlaying, currentBeat, onPlayNote, onStopNote, onStopAllLoopNotes }: UseLooperProps) => {
  const [loopState, setLoopState] = useState<'idle' | 'countingIn' | 'recording' | 'playing' | 'overdubbing'>('idle');
  const [loop, setLoop] = useState<LoopEvent[]>([]);
  const [progress, setProgress] = useState(0);

  // --- REFS ---
  const schedulerFrameRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingStopTimeRef = useRef<number>(0);
  const loopPlaybackStartTimeRef = useRef<number>(0);

  const pendingNotesRef = useRef<Map<string, number>>(new Map());
  const recordedEventsRef = useRef<LoopEvent[]>([]);
  
  const waitingForDownbeatRef = useRef(false);
  const nextEventIndexRef = useRef(0);
  const lastProgressRef = useRef(0);
  const countInMeasuresRemainingRef = useRef(0);
  
  const loopDuration = (60 / bpm) * BEATS_PER_BAR * bars;

  const stopRecording = useCallback((preciseStopTime?: number) => {
      if (!audioContext || (loopState !== 'recording' && loopState !== 'overdubbing')) {
          return;
      }
      
      const stopTime = preciseStopTime ?? audioContext.currentTime;
      const effectiveStopTime = Math.min(stopTime, recordingStopTimeRef.current);

      // Finalize any notes that were still held down
      const newEvents: LoopEvent[] = [];
      pendingNotesRef.current.forEach((startTime, note) => {
          const duration = effectiveStopTime - startTime;
          const loopRelativeStartTime = startTime - recordingStartTimeRef.current;
          
          if (duration > 0.01 && loopRelativeStartTime >= 0 && loopRelativeStartTime < loopDuration) {
              const truncatedDuration = Math.min(duration, loopDuration - loopRelativeStartTime);
              newEvents.push({ note, startTime: loopRelativeStartTime, duration: truncatedDuration });
          }
      });
      
      const baseLoop = loopState === 'overdubbing' ? loop : [];
      const finalLoop = [...baseLoop, ...recordedEventsRef.current, ...newEvents]
          .sort((a, b) => a.startTime - b.startTime);

      // Clear all temporary recording stores
      pendingNotesRef.current.clear();
      recordedEventsRef.current = [];
      
      if (finalLoop.length > 0) {
          setLoop(finalLoop);
          
          const timeSinceRecordingStart = (preciseStopTime ?? audioContext.currentTime) - recordingStartTimeRef.current;
          lastProgressRef.current = timeSinceRecordingStart % loopDuration;
          loopPlaybackStartTimeRef.current = recordingStartTimeRef.current;
          nextEventIndexRef.current = 0;
          setLoopState('playing');
      } else {
          // If no notes were recorded, go back to idle.
          setLoop([]);
          setLoopState('idle');
          setProgress(0);
          lastProgressRef.current = 0;
      }
  }, [audioContext, loopState, loopDuration, loop]);

  // Effect to START recording on the downbeat after count-in
  useEffect(() => {
    if (loopState === 'countingIn' && waitingForDownbeatRef.current && currentBeat === 1 && audioContext) {
        if (countInMeasuresRemainingRef.current > 0) {
            countInMeasuresRemainingRef.current -= 1;
        }

        if (countInMeasuresRemainingRef.current === 0) {
            const startTime = audioContext.currentTime;
            recordingStartTimeRef.current = startTime;
            recordingStopTimeRef.current = startTime + loopDuration; // Set precise stop time
            loopPlaybackStartTimeRef.current = startTime; // Also used for progress bar during recording
            
            const nextState = loop.length > 0 ? 'overdubbing' : 'recording';
            setLoopState(nextState);
            waitingForDownbeatRef.current = false;
        }
    }
  }, [currentBeat, loopState, audioContext, loop.length, loopDuration]);

  // MAIN SCHEDULER: This requestAnimationFrame loop drives all timing-critical logic.
  useEffect(() => {
    if (loopState === 'idle' || loopState === 'countingIn' || !audioContext) {
        cancelAnimationFrame(schedulerFrameRef.current);
        if (loopState === 'idle') setProgress(0);
        return;
    }

    const scheduler = () => {
        const currentTime = audioContext.currentTime;

        // 1. Automatic Recording Stop Check
        if ((loopState === 'recording' || loopState === 'overdubbing') && currentTime >= recordingStopTimeRef.current) {
            stopRecording(recordingStopTimeRef.current);
            return; // State change will cancel this animation frame loop.
        }
        
        // 2. Playback Scheduling
        if ((loopState === 'playing' || loopState === 'overdubbing') && loop.length > 0) {
            const timeIntoPlayback = currentTime - loopPlaybackStartTimeRef.current;
            const currentLoopProgress = timeIntoPlayback % loopDuration;

            // More robust wrap detection: if progress has gone down, we've looped.
            if (currentLoopProgress < lastProgressRef.current) {
                nextEventIndexRef.current = 0;
            }
            lastProgressRef.current = currentLoopProgress;

            // Schedule all notes within the upcoming scheduling window
            while (nextEventIndexRef.current < loop.length) {
                const event = loop[nextEventIndexRef.current];
                let timeUntilEvent = event.startTime - currentLoopProgress;
                if (timeUntilEvent < -0.001) { // Add tolerance for floating point
                    timeUntilEvent += loopDuration;
                }
                const absoluteEventTime = currentTime + timeUntilEvent;

                if (absoluteEventTime < currentTime + SCHEDULING_WINDOW) {
                    onPlayNote(event.note, absoluteEventTime);
                    onStopNote(event.note, absoluteEventTime + event.duration);
                    nextEventIndexRef.current++;
                } else {
                    break; // Event is outside the window, wait for next scheduler call
                }
            }
        }
        
        // 3. Progress Bar Update
        if (loopPlaybackStartTimeRef.current > 0) {
            const elapsed = currentTime - loopPlaybackStartTimeRef.current;
            setProgress((elapsed % loopDuration) / loopDuration);
        }

        schedulerFrameRef.current = requestAnimationFrame(scheduler);
    };

    schedulerFrameRef.current = requestAnimationFrame(scheduler);

    return () => {
        cancelAnimationFrame(schedulerFrameRef.current);
    };
  }, [loopState, audioContext, loop, loopDuration, onPlayNote, onStopNote, stopRecording]);

  const noteOn = useCallback((note: string) => {
      if (!audioContext || (loopState !== 'recording' && loopState !== 'overdubbing')) return;
      pendingNotesRef.current.set(note, audioContext.currentTime);
  }, [audioContext, loopState]);

  const noteOff = useCallback((note: string) => {
    if (!audioContext || (loopState !== 'recording' && loopState !== 'overdubbing')) return;
    const startTime = pendingNotesRef.current.get(note);
    if (startTime !== undefined) {
        const endTime = audioContext.currentTime;
        const duration = endTime - startTime;
        if (duration > 0.01) {
            const loopRelativeStartTime = startTime - recordingStartTimeRef.current;
            // Only add the note if it started within the current loop's duration
            if (loopRelativeStartTime >= 0 && loopRelativeStartTime < loopDuration) {
                const truncatedDuration = Math.min(duration, loopDuration - loopRelativeStartTime);
                recordedEventsRef.current.push({ note, startTime: loopRelativeStartTime, duration: truncatedDuration });
            }
        }
        pendingNotesRef.current.delete(note);
    }
  }, [audioContext, loopState, loopDuration]);
  
  const startRecording = () => {
    if (!isMetronomePlaying || !audioContext) return;

    if (loopState === 'recording' || loopState === 'overdubbing') {
      stopRecording();
      return;
    }

    if (loopState === 'idle') {
      setLoop([]);
      recordedEventsRef.current = [];
      pendingNotesRef.current.clear();
    }
    
    setLoopState('countingIn');
    countInMeasuresRemainingRef.current = 2; // Set 2-measure count-in
    waitingForDownbeatRef.current = true;
  };

  const togglePlayback = () => {
      if (loopState === 'playing' || loopState === 'overdubbing') {
          setLoopState('idle');
          onStopAllLoopNotes();
      } else if (loop.length > 0 && audioContext) {
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
      setLoop([]);
      recordedEventsRef.current = [];
      pendingNotesRef.current.clear();
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
  };
};