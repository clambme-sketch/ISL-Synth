import React from 'react';
import { DownloadIcon, PlayIcon, RecordIcon, StopIcon, TrashIcon } from './icons';

interface LooperPanelProps {
    loopState: 'idle' | 'countingIn' | 'recording' | 'playing' | 'overdubbing';
    isMetronomePlaying: boolean;
    onRecord: () => void;
    onPlay: () => void;
    onClear: () => void;
    onDownload: () => void;
    loopProgress: number;
    isDownloading: boolean;
    hasLoop: boolean;
    countInBeat: number;
    loopBars: number;
    onLoopBarsChange: (bars: number) => void;
    isLooping: boolean;
}

const IconButton: React.FC<{
    onClick: () => void;
    disabled?: boolean;
    active?: boolean;
    children: React.ReactNode;
    label: string;
    className?: string;
}> = ({ onClick, disabled = false, active = false, children, label, className = '' }) => (
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
);


export const LooperPanel: React.FC<LooperPanelProps> = ({
    loopState, isMetronomePlaying, onRecord, onPlay, onClear, onDownload, loopProgress,
    isDownloading, hasLoop, countInBeat,
    loopBars, onLoopBarsChange, isLooping,
}) => {
  const isRecording = loopState === 'recording' || loopState === 'overdubbing';

  return (
    <div className="w-full bg-synth-gray-900 shadow-2xl rounded-xl p-4 flex flex-col gap-4">
        <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Looper</h3>
            <div className="flex items-center gap-2">
                <span className="text-sm text-synth-gray-500">Bars:</span>
                {[1, 2, 4, 8].map(bar => (
                    <button
                        key={bar}
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
                ))}
            </div>
        </div>
        <div className="relative w-full h-2 bg-synth-gray-800 rounded-full overflow-hidden">
            <div 
                className="absolute top-0 left-0 h-full bg-synth-cyan-500"
                style={{ width: `${loopProgress * 100}%` }}
            ></div>
        </div>
        <div className="flex items-center justify-around">
            <IconButton 
                onClick={onRecord} 
                disabled={!isMetronomePlaying && loopState === 'idle'}
                active={isRecording}
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

            <IconButton onClick={onPlay} active={loopState === 'playing' || loopState === 'overdubbing'} disabled={!hasLoop} label={loopState === 'playing' || loopState === 'overdubbing' ? 'Stop Playback' : 'Play Loop'}>
                {loopState === 'playing' || loopState === 'overdubbing' ? <StopIcon className="w-6 h-6"/> : <PlayIcon className="w-6 h-6"/>}
            </IconButton>

            <IconButton onClick={onClear} disabled={!hasLoop || isRecording} label="Clear Loop">
                <TrashIcon className="w-6 h-6"/>
            </IconButton>

            <IconButton onClick={onDownload} disabled={!hasLoop || isDownloading || isRecording} label="Download Loop">
                {isDownloading ? (
                     <div className="w-5 h-5 border-2 border-synth-gray-500 border-t-synth-cyan-500 rounded-full animate-spin"></div>
                ) : (
                    <DownloadIcon className="w-6 h-6"/>
                )}
            </IconButton>
        </div>
    </div>
  );
};