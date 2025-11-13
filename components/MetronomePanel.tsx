import React, { useState, useEffect } from 'react';
import { ChevronDownIcon } from './icons';

interface MetronomePanelProps {
    bpm: number;
    onBpmChange: (bpm: number) => void;
    isMetronomePlaying: boolean;
    onToggleMetronome: () => void;
    metronomeTick: boolean;
}

export const MetronomePanel: React.FC<MetronomePanelProps> = ({
    bpm, onBpmChange, isMetronomePlaying, onToggleMetronome, metronomeTick
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [localBpm, setLocalBpm] = useState(bpm.toString());

    useEffect(() => {
        setLocalBpm(bpm.toString());
    }, [bpm]);

    const handleBpmInputBlur = () => {
        let newBpm = parseInt(localBpm, 10);
        if (isNaN(newBpm)) {
            newBpm = bpm; // Revert
        } else {
            newBpm = Math.max(40, Math.min(240, newBpm)); // Clamp
        }
        onBpmChange(newBpm);
    };

    return (
        <div className="w-full bg-synth-gray-900 shadow-2xl rounded-xl p-4 flex flex-col gap-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex justify-between items-center w-full"
                aria-expanded={isOpen}
                aria-controls="metronome-content"
            >
                <h3 className="text-lg font-semibold text-white">Metronome</h3>
                <ChevronDownIcon className={`w-6 h-6 text-synth-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div
                id="metronome-content"
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
            >
                <div className="pt-4 border-t border-synth-gray-700/50 flex flex-col gap-4">
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
            </div>
        </div>
    );
};