
import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, DownloadIcon, PlayIcon, RecordIcon, StopIcon, TrashIcon } from './icons';
import { LoopVisualizer } from './LoopVisualizer';
import { Tooltip } from './Tooltip';

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
}

const IconButton: React.FC<{
    onClick: () => void;
    disabled?: boolean;
    active?: boolean;
    children: React.ReactNode;
    label: string;
    className?: string;
    showTooltip: boolean;
}> = ({ onClick, disabled = false, active = false, children, label, className = '', showTooltip }) => (
    <Tooltip text={label} show={showTooltip}>
        <button
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-150
                ${active 
                    ? 'bg-synth-cyan-500 text-synth-gray-900 shadow-[0_0_12px_3px_rgba(0,255,255,0.7)]' 
                    : 'bg-synth-gray-700 hover:bg-synth-gray-600'
                }
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-synth-gray-700
                ${className}`
            }
        >
            {children}
        </button>
    </Tooltip>
);

export const SequencerPanel: React.FC<SequencerPanelProps> = ({
    bpm, onBpmChange, isMetronomePlaying, onToggleMetronome, metronomeTick,
    loopState, onRecord, onPlay, onClear, onDownload, loopProgress,
    isDownloading, hasLoop, countInBeat,
    countInMeasure, loopBars, onLoopBarsChange, isLooping, loopBuffer, showTooltips
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isRecording = loopState === 'recording' || loopState === 'overdubbing';
  const [localBpm, setLocalBpm] = useState(bpm.toString());

  useEffect(() => {
    setLocalBpm(bpm.toString());
  }, [bpm]);

  const handleBpmInputBlur = () => {
    let newBpm = parseInt(localBpm, 10);
    if (isNaN(newBpm)) {
        newBpm = bpm;
    } else {
        newBpm = Math.max(40, Math.min(240, newBpm));
    }
    onBpmChange(newBpm);
  };

  const totalCountInBeats = 8;
  let countInProgress = 0;
  if (loopState === 'countingIn' && countInMeasure > 0) {
      const beatsElapsedInPreviousMeasures = (countInMeasure - 1) * 4;
      const beatsElapsed = beatsElapsedInPreviousMeasures + countInBeat;
      countInProgress = beatsElapsed / totalCountInBeats;
  }

  return (
    <div className="w-full bg-synth-gray-900 shadow-2xl rounded-xl p-4 flex flex-col gap-4">
        <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex justify-between items-center w-full"
            aria-expanded={isOpen}
            aria-controls="sequencer-content"
        >
            <h3 className="text-lg font-semibold text-white">Metronome & Looper</h3>
            <ChevronDownIcon className={`w-6 h-6 text-synth-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

         <div
            id="sequencer-content"
            className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'}`}
        >
            <div className="pt-4 border-t border-synth-gray-700/50 flex flex-col md:flex-row gap-4">
              {/* Metronome */}
              <div className="bg-synth-gray-800 p-4 rounded-lg flex-grow md:w-1/3 flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-white text-center">Metronome</h3>
                <div className="flex items-center justify-center gap-4">
                  <div
                    className={`w-5 h-5 rounded-full border-2 border-black/50 transition-all duration-75
                      ${(metronomeTick && isMetronomePlaying)
                        ? 'bg-synth-cyan-500 shadow-[0_0_10px_2px_rgba(0,255,255,0.7)]'
                        : 'bg-synth-gray-700 shadow-inner'
                      }`}
                  ></div>
                  <button
                    onClick={onToggleMetronome}
                    className={`px-4 py-2 rounded-md font-bold text-sm transition-colors w-24
                      ${isMetronomePlaying ? 'bg-synth-purple-500 text-white' : 'bg-synth-gray-700 hover:bg-synth-gray-600'}`}
                  >
                    {isMetronomePlaying ? 'STOP' : 'START'}
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-synth-gray-500">BPM</label>
                    <input
                      type="number"
                      value={localBpm}
                      onChange={(e) => setLocalBpm(e.target.value)}
                      onBlur={handleBpmInputBlur}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      min="40"
                      max="240"
                      className="text-center w-16 bg-synth-gray-700 text-white font-mono text-xs px-2 py-0.5 rounded outline-none focus:ring-2 focus:ring-synth-cyan-500"
                      aria-label="Beats Per Minute value"
                    />
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={240}
                    step={1}
                    value={bpm}
                    onChange={(e) => onBpmChange(parseInt(e.target.value, 10))}
                    className="horizontal-slider"
                    aria-label="Beats Per Minute slider"
                  />
                </div>
              </div>

              {/* Looper */}
              <div className="bg-synth-gray-800 p-4 rounded-lg flex-grow md:w-2/3 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white">Looper</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-synth-gray-500">Bars:</span>
                        {[1, 2, 4, 8].map(bar => (
                            <Tooltip key={bar} text={`Loop Length: ${bar} Bars`} show={showTooltips}>
                                <button
                                    onClick={() => onLoopBarsChange(bar)}
                                    disabled={isLooping}
                                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                        loopBars === bar
                                            ? 'bg-synth-cyan-500 text-synth-gray-900 font-bold'
                                            : 'bg-synth-gray-700 hover:bg-synth-gray-600 disabled:opacity-50 disabled:hover:bg-synth-gray-700'
                                    }`}
                                >
                                    {bar}
                                </button>
                            </Tooltip>
                        ))}
                    </div>
                </div>
                <div className="relative w-full h-2 bg-synth-gray-900 rounded-full overflow-hidden">
                    <div 
                        className="absolute top-0 left-0 h-full bg-synth-cyan-500"
                        style={{ width: `${loopProgress * 100}%` }}
                    ></div>
                    {/* Count-in progress bar */}
                    {loopState === 'countingIn' && (
                        <div
                            className="absolute top-0 left-0 h-full bg-yellow-500"
                            style={{ 
                                width: `${countInProgress * 100}%`,
                                transition: `width ${60/bpm}s linear` 
                            }}
                        ></div>
                    )}
                </div>
                <div className="flex items-center justify-around">
                    <IconButton 
                        onClick={onRecord} 
                        disabled={!isMetronomePlaying && loopState === 'idle'}
                        active={isRecording}
                        showTooltip={showTooltips}
                        className={`relative
                            ${isRecording ? 'bg-red-600 text-white shadow-[0_0_12px_3px_rgba(255,0,0,0.7)] animate-pulse' : ''}
                            ${loopState === 'countingIn' ? 'bg-yellow-500 text-white shadow-[0_0_12px_3px_rgba(255,255,0,0.7)] animate-pulse' : ''}
                        `}
                        label={isRecording ? 'Stop Recording' : 'Record'}
                    >
                        {countInBeat > 0 ? (
                            <span className="text-2xl font-bold">{countInBeat}</span>
                        ) : (
                            <RecordIcon className="w-6 h-6" />
                        )}
                    </IconButton>

                    <IconButton onClick={onPlay} active={loopState === 'playing' || loopState === 'overdubbing'} disabled={!hasLoop} label={loopState === 'playing' || loopState === 'overdubbing' ? 'Stop Playback' : 'Play Loop'} showTooltip={showTooltips}>
                        {loopState === 'playing' || loopState === 'overdubbing' ? <StopIcon className="w-6 h-6"/> : <PlayIcon className="w-6 h-6"/>}
                    </IconButton>

                    <IconButton onClick={onClear} disabled={!hasLoop || isRecording} label="Clear Loop" showTooltip={showTooltips}>
                        <TrashIcon className="w-6 h-6"/>
                    </IconButton>

                    <IconButton onClick={onDownload} disabled={!hasLoop || isDownloading || isRecording} label="Download Loop" showTooltip={showTooltips}>
                        {isDownloading ? (
                             <div className="w-5 h-5 border-2 border-synth-gray-500 border-t-synth-cyan-500 rounded-full animate-spin"></div>
                        ) : (
                            <DownloadIcon className="w-6 h-6"/>
                        )}
                    </IconButton>
                </div>

                {loopBuffer && (
                    <div className="mt-4 h-16 bg-synth-gray-900 rounded-md">
                        <LoopVisualizer audioBuffer={loopBuffer} progress={loopProgress} />
                    </div>
                )}
              </div>
            </div>
        </div>
    </div>
  );
};
