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
const SCHEDULING_WINDOW = 0.1; // seconds

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

    timedEventsRef.current.sort((a, b) => a.time - b.time);

    for (const event of timedEventsRef.current) {
        if (event.time < -0.001 || event.time >= loopDuration) {
            continue;
        }
        
        const eventTime = Math.max(0, event.time);

        if (event.type === 'on') {
            if (noteStartTimes.has(event.note)) {
                const startTime = noteStartTimes.get(event.note)!;
                const duration = eventTime - startTime;
                if (duration > 0.01) {
                    newLoopEvents.push({ note: event.note, startTime, duration });
                }
            }
            noteStartTimes.set(event.note, eventTime);
        } else if (event.type === 'off') {
            if (noteStartTimes.has(event.note)) {
                const startTime = noteStartTimes.get(event.note)!;
                const duration = eventTime - startTime;
                if (duration > 0.01) {
                    newLoopEvents.push({ note: event.note, startTime, duration });
                }
                noteStartTimes.delete(event.note);
            }
        }
    }

    noteStartTimes.forEach((startTime, note) => {
        const duration = loopDuration - startTime;
        if (duration > 0.01) {
            newLoopEvents.push({ note, startTime, duration });
        }
    });
      
    const finalLoop = [...baseLoop, ...newLoopEvents]
        .sort((a, b) => a.startTime - b.startTime);

    timedEventsRef.current = [];
    setCountInMeasure(0);
    
    if (finalLoop.length > 0) {
        setLoop(finalLoop);
        
        const timeSinceRecordingStart = (preciseStopTime ?? audioContext.currentTime) - recordingStartTimeRef.current;
        lastProgressRef.current = timeSinceRecordingStart % loopDuration;
        loopPlaybackStartTimeRef.current = recordingStartTimeRef.current;
        nextEventIndexRef.current = 0;
        setLoopState('playing');
    } else {
        setLoop([]);
        setLoopState('idle');
        setProgress(0);
        lastProgressRef.current = 0;
    }
  }, [audioContext, loopState, loopDuration, loop]);

  useEffect(() => {
    const { beat, time } = beatInfo;
    if (loopState !== 'countingIn' || !waitingForDownbeatRef.current || beat !== 1 || !audioContext) {
        return;
    }

    if (countInMeasuresRemainingRef.current > 1) {
        countInMeasuresRemainingRef.current -= 1;
        setCountInMeasure(prev => prev + 1);
    } else {
        const startTime = time;
        recordingStartTimeRef.current = startTime;
        recordingStopTimeRef.current = startTime + loopDuration;
        loopPlaybackStartTimeRef.current = startTime;
        
        const nextState = loop.length > 0 ? 'overdubbing' : 'recording';
        setLoopState(nextState);
        waitingForDownbeatRef.current = false;
        setCountInMeasure(0);
    }
  }, [beatInfo, loopState, audioContext, loop.length, loopDuration]);

  useEffect(() => {
    if (loopState === 'idle' || loopState === 'countingIn' || !audioContext) {
        cancelAnimationFrame(schedulerFrameRef.current);
        if (loopState === 'idle') setProgress(0);
        return;
    }

    const scheduler = () => {
        const currentTime = audioContext.currentTime;

        if ((loopState === 'recording' || loopState === 'overdubbing') && currentTime >= recordingStopTimeRef.current) {
            stopRecording(recordingStopTimeRef.current);
            return;
        }
        
        if ((loopState === 'playing' || loopState === 'overdubbing') && loop.length > 0) {
            const timeIntoPlayback = currentTime - loopPlaybackStartTimeRef.current;
            const currentLoopProgress = timeIntoPlayback % loopDuration;

            if (currentLoopProgress < lastProgressRef.current) {
                nextEventIndexRef.current = 0;
            }
            lastProgressRef.current = currentLoopProgress;

            while (nextEventIndexRef.current < loop.length) {
                const event = loop[nextEventIndexRef.current];
                let timeUntilEvent = event.startTime - currentLoopProgress;
                if (timeUntilEvent < -0.001) {
                    timeUntilEvent += loopDuration;
                }
                const absoluteEventTime = currentTime + timeUntilEvent;

                if (absoluteEventTime < currentTime + SCHEDULING_WINDOW) {
                    onPlayNote(event.note, absoluteEventTime);
                    onStopNote(event.note, absoluteEventTime + event.duration);
                    nextEventIndexRef.current++;
                } else {
                    break;
                }
            }
        }
        
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
    countInMeasuresRemainingRef.current = 2;
    setCountInMeasure(1);
    waitingForDownbeatRef.current = true;
  };

  const togglePlayback = () => {
      if (loopState === 'playing' || loopState === 'overdubbing') {
          setLoopState('idle');
          setCountInMeasure(0);
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
  };
};