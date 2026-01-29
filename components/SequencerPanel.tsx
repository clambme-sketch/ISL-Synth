
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon, DownloadIcon, PlayIcon, RecordIcon, StopIcon, TrashIcon, PlusIcon } from './icons';
import { LoopVisualizer } from './LoopVisualizer';
import { Tooltip } from './Tooltip';
import type { DrumPattern, DrumType, LoopEvent } from '../types';

interface SequencerPanelProps {
    bpm: number;
    onBpmChange: (bpm: number) => void;
    isMetronomePlaying: boolean;
    onToggleMetronome: () => void;
    metronomeTick: boolean;
    loopState: 'idle' | 'countingIn' | 'recording' | 'playing' | 'overdubbing';
    onRecord: () => void;
    onPlay: () => void;
    onClear: () => void;
    onDownload: () => void;
    loopProgress: number;
    isDownloading: boolean;
    hasLoop: boolean;
    countInBeat: number;
    countInMeasure: number;
    loopBars: number;
    onLoopBarsChange: (bars: number) => void;
    isLooping: boolean;
    loopBuffer: AudioBuffer | null;
    showTooltips: boolean;
    drumPattern: DrumPattern;
    onDrumPatternChange: (pattern: DrumPattern) => void;
    currentStep: number;
    mode: 'metronome' | 'drums';
    onModeChange: (mode: 'metronome' | 'drums') => void;
    onAddToPatterns: () => void;
    
    // Multi-slot props
    loops: Record<string, LoopEvent[]>;
    activeSlot: string;
    queuedSlot: string | null;
    onSlotChange: (slot: string) => void;
}

const ControlButton: React.FC<{
    onClick: () => void;
    disabled?: boolean;
    active?: boolean;
    activeColor?: string;
    children: React.ReactNode;
    label: string;
    subLabel?: string;
    className?: string;
    showTooltip: boolean;
}> = ({ onClick, disabled = false, active = false, activeColor = 'border-synth-cyan-500', children, label, subLabel, className = '', showTooltip }) => (
    <Tooltip text={label} show={showTooltip} className="w-full h-full">
        <button
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={`relative flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 border-2 w-full h-full
                ${active 
                    ? `bg-synth-gray-800 ${activeColor} shadow-[0_0_15px_rgba(0,0,0,0.5)] transform scale-105 z-10` 
                    : 'bg-synth-gray-800 border-transparent hover:bg-synth-gray-700 hover:border-synth-gray-600'
                }
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-synth-gray-800 disabled:hover:border-transparent
                ${className}`
            }
        >
            <div className={`mb-1 ${active ? 'text-white' : 'text-synth-gray-400'}`}>
                {children}
            </div>
            {subLabel && (
                <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? 'text-white' : 'text-synth-gray-500'}`}>
                    {subLabel}
                </span>
            )}
        </button>
    </Tooltip>
);

// ... rest of the file is unchanged, but included for context if needed ...
// I will provide the full file content to ensure no structure is broken.

const ClockVisualizer: React.FC<{
    progress: number;
    state: string;
    bars: number;
    countInBeat: number;
    onCenterClick: () => void;
    hasLoop: boolean;
}> = ({ progress, state, bars, countInBeat, onCenterClick, hasLoop }) => {
    const radius = 56; // Slightly larger for better visibility
    const stroke = 6;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - progress * circumference;

    let stateColor = '#3D3D3D'; // Gray (Idle)
    let glowColor = 'transparent';
    let centerIcon = <div className="w-2 h-2 rounded-full bg-synth-gray-600" />;

    if (state === 'recording') {
        stateColor = '#EF4444'; // Red
        glowColor = 'rgba(239, 68, 68, 0.6)';
        centerIcon = <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />;
    } else if (state === 'overdubbing') {
        stateColor = '#F59E0B'; // Amber
        glowColor = 'rgba(245, 158, 11, 0.6)';
        centerIcon = <div className="w-4 h-4 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]" />;
    } else if (state === 'playing') {
        stateColor = '#06b6d4'; // Cyan
        glowColor = 'rgba(6, 182, 212, 0.6)';
        centerIcon = <PlayIcon className="w-6 h-6 text-synth-cyan-400 ml-1" />;
    } else if (state === 'countingIn') {
        stateColor = '#EAB308'; // Yellow
        glowColor = 'rgba(234, 179, 8, 0.6)';
        centerIcon = <span className="text-2xl font-black text-yellow-500">{countInBeat}</span>;
    } else if (hasLoop) {
         // Idle but has loop
         centerIcon = <PlayIcon className="w-6 h-6 text-synth-gray-500 ml-1" />;
    }

    // Generate Measure Dividers (The "Clock" Markers)
    const dividers = [];
    if (state !== 'countingIn' && bars >= 1) {
        // If bars = 1, we show 4 beats ticks
        const segments = bars === 1 ? 4 : bars;
        
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * 360;
            dividers.push(
                <div 
                    key={i}
                    className={`absolute w-0.5 bg-synth-gray-900 z-10 ${bars === 1 ? 'h-1.5 opacity-50' : 'h-3'}`}
                    style={{ 
                        top: stroke + 2, 
                        left: '50%', 
                        transformOrigin: `0 ${radius - (stroke + 2)}px`,
                        transform: `translateX(-50%) rotate(${angle}deg)` 
                    }} 
                />
            );
        }
    }

    return (
        <div className="relative flex items-center justify-center w-32 h-32 select-none flex-shrink-0">
            {/* Interactive Area */}
            <div 
                className={`relative w-full h-full rounded-full flex items-center justify-center transition-transform active:scale-95 ${hasLoop || state === 'recording' || state === 'idle' ? 'cursor-pointer' : ''}`}
                onClick={onCenterClick}
            >
                {/* SVG Ring */}
                <svg
                    height={radius * 2}
                    width={radius * 2}
                    className="rotate-[-90deg] drop-shadow-lg"
                >
                    {/* Track Background */}
                    <circle
                        stroke="#18181b"
                        strokeWidth={stroke}
                        fill="#09090b"
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                    />

                    {/* Count-In Segments */}
                    {state === 'countingIn' && (
                        <>
                            {[0, 1, 2, 3].map((i) => {
                                const isActive = i < countInBeat;
                                const segmentCircumference = circumference / 4;
                                const gap = 4;
                                const dashArray = `${segmentCircumference - gap} ${circumference - (segmentCircumference - gap)}`;
                                const offset = -1 * (i * segmentCircumference);
                                
                                return (
                                    <circle
                                        key={i}
                                        stroke={isActive ? stateColor : '#27272a'}
                                        fill="transparent"
                                        strokeWidth={stroke}
                                        strokeDasharray={dashArray}
                                        strokeDashoffset={offset}
                                        strokeLinecap="round"
                                        r={normalizedRadius}
                                        cx={radius}
                                        cy={radius}
                                        style={{ transition: 'stroke 0.1s' }}
                                    />
                                );
                            })}
                        </>
                    )}

                    {/* Continuous Progress Ring */}
                    {state !== 'countingIn' && (
                        <circle
                            stroke={stateColor}
                            fill="transparent"
                            strokeWidth={stroke}
                            strokeDasharray={circumference + ' ' + circumference}
                            style={{ 
                                strokeDashoffset, 
                                transition: 'none', // FIXED: Disable transition for smooth JS animation
                                filter: `drop-shadow(0 0 4px ${glowColor})`
                            }}
                            strokeLinecap="butt"
                            r={normalizedRadius}
                            cx={radius}
                            cy={radius}
                        />
                    )}
                </svg>

                {/* Markers Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                    {dividers}
                </div>
                
                {/* Center Icon */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {centerIcon}
                </div>
            </div>
        </div>
    );
};

export const SequencerPanel: React.FC<SequencerPanelProps> = ({
    bpm, onBpmChange, isMetronomePlaying, onToggleMetronome, metronomeTick,
    loopState, onRecord, onPlay, onClear, onDownload, loopProgress,
    isDownloading, hasLoop, countInBeat,
    countInMeasure, loopBars, onLoopBarsChange, isLooping, loopBuffer, showTooltips,
    drumPattern, onDrumPatternChange, currentStep, mode, onModeChange, onAddToPatterns,
    loops, activeSlot, queuedSlot, onSlotChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isRecording = loopState === 'recording' || loopState === 'overdubbing';
  const [localBpm, setLocalBpm] = useState(bpm.toString());
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  useEffect(() => {
    setLocalBpm(bpm.toString());
  }, [bpm]);

  const handleBpmInputBlur = () => {
    let newBpm = parseInt(localBpm, 10);
    if (isNaN(newBpm)) newBpm = bpm;
    else newBpm = Math.max(40, Math.min(240, newBpm));
    onBpmChange(newBpm);
  };

  const handleTapTempo = () => {
      const now = performance.now();
      const recentTaps = [...tapTimes, now].filter(t => now - t < 2000);
      
      if (recentTaps.length > 1) {
          const intervals = [];
          for (let i = 1; i < recentTaps.length; i++) {
              intervals.push(recentTaps[i] - recentTaps[i - 1]);
          }
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const newBpm = Math.round(60000 / avgInterval);
          const clampedBpm = Math.max(40, Math.min(240, newBpm));
          onBpmChange(clampedBpm);
      }
      setTapTimes(recentTaps);
  };

  const handleCenterClick = () => {
      if (hasLoop) {
          onPlay();
      } else if (loopState === 'idle') {
          onRecord();
      }
  };
  
  const handleCustomBarsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val > 0 && val <= 64) {
          onLoopBarsChange(val);
      }
  };

  const toggleDrumStep = (type: DrumType, step: number) => {
      const newPattern = {
          ...drumPattern,
          [type]: drumPattern[type].map((isActive, index) => index === step ? !isActive : isActive)
      };
      onDrumPatternChange(newPattern);
  };

  // Determine status text
  let statusText = "READY";
  let statusColor = "text-synth-gray-500";
  let subText = "IDLE";
  
  if (loopState === 'recording') {
      statusText = "RECORDING";
      statusColor = "text-red-500";
      subText = `SLOT ${activeSlot} INPUT`;
  } else if (loopState === 'overdubbing') {
      statusText = "OVERDUB";
      statusColor = "text-amber-500";
      subText = `SLOT ${activeSlot}`;
  } else if (loopState === 'playing') {
      statusText = "PLAYING";
      statusColor = "text-synth-cyan-500";
      subText = `SLOT ${activeSlot}`;
  } else if (loopState === 'countingIn') {
      statusText = "COUNT IN";
      statusColor = "text-yellow-500";
      subText = `TO SLOT ${activeSlot}`;
  } else if (hasLoop) {
      statusText = "STOPPED";
      statusColor = "text-white";
      subText = `SLOT ${activeSlot} LOADED`;
  }

  let displayProgress = loopProgress;
  if (loopState === 'countingIn' && countInMeasure > 0) {
      displayProgress = 0; 
  }

  const renderDrumRow = (type: DrumType, label: string, colorClass: string, activeClass: string) => (
      <div className="flex items-center gap-2 h-8 w-full">
          <div className={`w-10 h-full rounded-md flex items-center justify-center ${colorClass} bg-opacity-20 flex-shrink-0`}>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${activeClass}`}>{label}</span>
          </div>
          <div className="flex-grow grid grid-cols-4 gap-1 h-full">
              {[0, 1, 2, 3].map(beat => (
                  <div key={beat} className="grid grid-cols-4 gap-[2px] h-full">
                      {[0, 1, 2, 3].map(subStep => {
                          const stepIndex = beat * 4 + subStep;
                          const isActive = drumPattern[type][stepIndex];
                          const isCurrent = currentStep === stepIndex && isMetronomePlaying;
                          
                          return (
                              <div
                                  key={stepIndex}
                                  onClick={() => toggleDrumStep(type, stepIndex)}
                                  className={`
                                      relative cursor-pointer rounded-sm transition-all duration-75
                                      ${isActive 
                                          ? `${colorClass} shadow-[0_0_8px_rgba(0,0,0,0.5)] scale-[0.95]` 
                                          : 'bg-synth-gray-700 hover:bg-synth-gray-600'
                                      }
                                      ${isCurrent ? 'brightness-200 ring-1 ring-white z-10' : ''}
                                  `}
                              >
                                  {/* Inner Glow for active state */}
                                  {isActive && <div className="absolute inset-0 bg-white opacity-20 pointer-events-none" />}
                              </div>
                          );
                      })}
                  </div>
              ))}
          </div>
      </div>
  );

  return (
    <div className="w-full bg-synth-gray-900 shadow-2xl rounded-xl p-4 flex flex-col gap-4">
        <Tooltip text="Access the metronome, drum machine, and a live looper to record your performances." show={showTooltips}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex justify-between items-center w-full"
                aria-expanded={isOpen}
                aria-controls="sequencer-content"
            >
                <h3 className="text-lg font-semibold text-white">Metronome & Looper</h3>
                <ChevronDownIcon className={`w-6 h-6 text-synth-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
        </Tooltip>

         <div
            id="sequencer-content"
            className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1200px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'}`}
        >
            <div className="pt-6 border-t border-synth-gray-700/50 flex flex-col gap-6 items-start">
              
              {/* TOP: Metronome/Drums Controls */}
              <div className="w-full flex flex-col gap-5 flex-shrink-0 bg-synth-gray-800 p-5 rounded-xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] border border-synth-gray-700">
                <div className="flex justify-between items-end">
                    <label className="text-xs font-bold text-synth-gray-500 uppercase tracking-widest">{mode === 'drums' ? 'Drum Machine' : 'Metronome'}</label>
                    <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full transition-colors duration-75 ${metronomeTick && isMetronomePlaying ? 'bg-synth-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-synth-gray-600'}`} />
                         <span className={`text-[10px] font-bold uppercase transition-colors ${isMetronomePlaying ? 'text-synth-cyan-500' : 'text-synth-gray-600'}`}>
                            {isMetronomePlaying ? 'ON' : 'OFF'}
                         </span>
                    </div>
                </div>

                <div className="bg-synth-gray-900/50 rounded-lg p-3 border border-synth-gray-700/50 flex flex-col gap-3">
                    
                    <div className="flex gap-4 items-stretch">
                        
                        <div className="flex flex-col gap-2 w-20 flex-shrink-0">
                             <div className="w-full flex items-center justify-center bg-black/40 h-8 rounded border border-synth-gray-700 relative group">
                                <input
                                    type="number"
                                    value={localBpm}
                                    onChange={(e) => setLocalBpm(e.target.value)}
                                    onBlur={handleBpmInputBlur}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                    className="w-full h-full bg-transparent text-center text-sm font-mono text-white outline-none z-10"
                                />
                                <span className="absolute bottom-0.5 right-1 text-[7px] text-synth-gray-500 font-bold pointer-events-none">BPM</span>
                             </div>
                             
                             <Tooltip text="Tap rhythm to set BPM" show={showTooltips}>
                                <button 
                                    onClick={handleTapTempo}
                                    className="w-full h-8 bg-synth-gray-700 hover:bg-synth-gray-600 text-synth-gray-300 font-bold text-[10px] uppercase rounded border border-synth-gray-600 active:bg-synth-cyan-600 active:text-white transition-all shadow-sm"
                                >
                                    TAP
                                </button>
                             </Tooltip>
                        </div>

                        <div className="flex-grow flex flex-col justify-center gap-1">
                             <div className="flex justify-between px-1">
                                 <span className="text-[9px] font-bold text-synth-gray-500 uppercase">Slow</span>
                                 <span className="text-[9px] font-bold text-synth-gray-500 uppercase">Fast</span>
                             </div>
                             <div className="h-8 flex items-center bg-black/20 rounded-lg px-2 border border-synth-gray-800">
                                <input
                                    type="range"
                                    min={40}
                                    max={240}
                                    step={1}
                                    value={bpm}
                                    onChange={(e) => onBpmChange(parseInt(e.target.value, 10))}
                                    className="horizontal-slider flex-grow h-4" 
                                />
                             </div>
                        </div>

                        <div className="flex flex-col gap-2 w-28 flex-shrink-0">
                             <Tooltip text="Switch to Metronome" show={showTooltips}>
                                <button 
                                    onClick={() => onModeChange('metronome')}
                                    className={`h-8 w-full font-bold text-[10px] uppercase rounded border transition-all shadow-sm flex items-center justify-center gap-1 ${
                                        mode === 'metronome' 
                                        ? 'bg-synth-purple-500 text-white border-synth-purple-400' 
                                        : 'bg-synth-gray-700 hover:bg-synth-gray-600 text-synth-gray-300 border-synth-gray-600'
                                    }`}
                                >
                                    Metronome
                                </button>
                            </Tooltip>
                            <Tooltip text="Switch to Drum Machine" show={showTooltips}>
                                <button 
                                    onClick={() => onModeChange('drums')}
                                    className={`h-8 w-full font-bold text-[10px] uppercase rounded border transition-all shadow-sm flex items-center justify-center gap-1 ${
                                        mode === 'drums' 
                                        ? 'bg-synth-purple-500 text-white border-synth-purple-400' 
                                        : 'bg-synth-gray-700 hover:bg-synth-gray-600 text-synth-gray-300 border-synth-gray-600'
                                    }`}
                                >
                                    Drum Machine
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                    
                    {mode === 'drums' && (
                        <div className="flex flex-col gap-3 pt-2 h-32 justify-center w-full px-1 border-t border-synth-gray-700/50">
                            {renderDrumRow('kick', 'KICK', 'bg-red-600', 'text-red-400')}
                            {renderDrumRow('snare', 'SNR', 'bg-synth-cyan-500', 'text-synth-cyan-400')}
                            {renderDrumRow('hihat', 'HH', 'bg-yellow-500', 'text-yellow-400')}
                        </div>
                    )}
                </div>

                <button
                    onClick={onToggleMetronome}
                    className={`w-full py-3 rounded-lg font-bold text-sm uppercase tracking-widest transition-all shadow-md transform active:scale-[0.98]
                    ${isMetronomePlaying 
                        ? 'bg-synth-purple-500 text-white shadow-synth-purple-500/20 hover:bg-synth-purple-400' 
                        : 'bg-synth-gray-700 text-synth-gray-400 hover:bg-synth-gray-600 hover:text-white'}`}
                >
                    {isMetronomePlaying ? 'Stop' : 'Start'}
                </button>

                <div className="h-px bg-synth-gray-700 w-full my-1" />

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-synth-gray-500 uppercase tracking-widest">Loop Length</label>
                    <div className="flex gap-2 h-9">
                        <div className="flex-grow flex bg-synth-gray-900 rounded-lg p-1 gap-1 border border-synth-gray-700">
                            {[1, 2, 4, 8].map(bar => (
                                <button
                                    key={bar}
                                    onClick={() => onLoopBarsChange(bar)}
                                    disabled={isLooping}
                                    className={`flex-1 rounded text-[10px] font-bold transition-all ${
                                        loopBars === bar
                                            ? 'bg-synth-cyan-500 text-synth-gray-900 shadow-sm'
                                            : 'text-synth-gray-500 hover:text-white hover:bg-synth-gray-700 disabled:opacity-30'
                                    }`}
                                >
                                    {bar}
                                </button>
                            ))}
                        </div>
                        <div className="w-12 relative group">
                            <input 
                                type="number" 
                                min="1" 
                                max="64"
                                value={loopBars}
                                onChange={handleCustomBarsChange}
                                disabled={isLooping}
                                className="w-full h-full bg-synth-gray-900 border border-synth-gray-700 rounded-lg text-center text-xs text-white outline-none focus:border-synth-cyan-500 transition-colors"
                            />
                        </div>
                    </div>
                </div>
              </div>

              {/* BOTTOM: Looper Interface */}
              <div className="flex flex-row items-center justify-between gap-6 w-full p-6 bg-synth-gray-800/50 rounded-xl border border-synth-gray-700/30">
                   
                   {/* 1. Visual Clock (Left) */}
                   <ClockVisualizer 
                        progress={displayProgress} 
                        state={loopState} 
                        bars={loopBars}
                        countInBeat={countInBeat}
                        onCenterClick={handleCenterClick}
                        hasLoop={hasLoop}
                   />

                   {/* 2. Controls & Info Column */}
                   <div className="flex-grow flex flex-col justify-between h-full min-h-[160px] gap-4">
                        
                        {/* Top: Status & Slot Selector */}
                        <div className="flex justify-between items-start border-b border-synth-gray-700/50 pb-2">
                             {/* Slot Selector */}
                             <div className="flex gap-2">
                                {['A', 'B', 'C', 'D'].map(slot => {
                                    const isActive = activeSlot === slot;
                                    const isQueued = queuedSlot === slot;
                                    const hasData = loops[slot].length > 0;
                                    
                                    let bgClass = 'bg-synth-gray-900 text-synth-gray-500 hover:bg-synth-gray-700';
                                    if (isActive) bgClass = 'bg-synth-cyan-500 text-synth-gray-900 font-bold shadow-lg';
                                    else if (isQueued) bgClass = 'bg-yellow-500 text-synth-gray-900 animate-pulse';
                                    else if (hasData) bgClass = 'bg-synth-gray-700 text-white';

                                    return (
                                        <button
                                            key={slot}
                                            onClick={() => onSlotChange(slot)}
                                            className={`w-8 h-8 rounded-lg text-xs transition-all border border-transparent ${bgClass} ${isActive ? 'scale-110' : ''}`}
                                        >
                                            {slot}
                                        </button>
                                    );
                                })}
                             </div>

                             <div className="flex flex-col items-end">
                                 <h2 className={`text-3xl font-black tracking-tighter ${statusColor} ${isRecording ? 'animate-pulse' : ''}`}>
                                    {statusText}
                                 </h2>
                                 <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-mono text-synth-gray-500">{bpm} BPM</span>
                                    <span className="text-[10px] font-bold text-synth-gray-400 uppercase tracking-widest">{subText}</span>
                                 </div>
                             </div>
                        </div>

                        {/* Bottom: Button Grid */}
                        <div className="grid grid-cols-5 gap-3">
                            <ControlButton 
                                onClick={onRecord} 
                                disabled={!isMetronomePlaying && loopState === 'idle'}
                                active={isRecording || loopState === 'countingIn'}
                                activeColor={loopState === 'countingIn' ? 'border-yellow-500' : 'border-red-500'}
                                label={isRecording ? 'Stop Recording' : 'Record'}
                                subLabel="REC"
                                showTooltip={showTooltips}
                            >
                                <RecordIcon className={`w-5 h-5 ${isRecording ? 'text-red-500' : ''}`} />
                            </ControlButton>

                            <ControlButton 
                                onClick={onPlay} 
                                active={loopState === 'playing' || loopState === 'overdubbing'}
                                activeColor="border-synth-cyan-500"
                                disabled={!hasLoop && loopState === 'idle'} 
                                label={loopState === 'playing' ? 'Stop' : 'Play'}
                                subLabel="PLAY"
                                showTooltip={showTooltips}
                            >
                                {(loopState === 'playing' || loopState === 'overdubbing') ? <StopIcon className="w-5 h-5 text-synth-cyan-500"/> : <PlayIcon className="w-5 h-5"/>}
                            </ControlButton>

                            <ControlButton onClick={onClear} disabled={(!hasLoop && loopState === 'idle') || isRecording} label="Clear Loop" subLabel="CLEAR" showTooltip={showTooltips}>
                                <TrashIcon className="w-5 h-5"/>
                            </ControlButton>

                            <ControlButton onClick={onDownload} disabled={!hasLoop || isDownloading || isRecording} label="Download Loop" subLabel="SAVE" showTooltip={showTooltips}>
                                {isDownloading ? (
                                    <div className="w-4 h-4 border-2 border-synth-gray-500 border-t-synth-cyan-500 rounded-full animate-spin"></div>
                                ) : (
                                    <DownloadIcon className="w-5 h-5"/>
                                )}
                            </ControlButton>
                            
                            <ControlButton onClick={onAddToPatterns} disabled={!hasLoop || isRecording} label="Add Loop to Song Patterns" subLabel="TO SEQ" showTooltip={showTooltips}>
                                <PlusIcon className="w-5 h-5"/>
                            </ControlButton>
                        </div>
                   </div>
              </div>
            </div>
            
            {/* Mini Waveform */}
            {loopBuffer && (
                <div className="mt-4 h-12 bg-black rounded border border-synth-gray-800 opacity-80 overflow-hidden relative">
                     <div className="absolute inset-0 flex pointer-events-none z-10 opacity-20">
                        {Array.from({ length: loopBars }).map((_, i) => (
                             <div key={i} className="flex-1 border-r border-white last:border-0" />
                        ))}
                     </div>
                    <LoopVisualizer audioBuffer={loopBuffer} progress={loopProgress} />
                </div>
            )}
        </div>
    </div>
  );
};
