import React, { useState } from 'react';
import type { ChordMode } from '../types';
import { ChevronDownIcon } from './icons';

interface AutoChordsPanelProps {
    isOn: boolean;
    onToggle: (isOn: boolean) => void;
    mode: ChordMode;
    onModeChange: (mode: ChordMode) => void;
    diatonicKey: string;
    onDiatonicKeyChange: (key: string) => void;
    diatonicScale: 'major' | 'minor';
    onDiatonicScaleChange: (scale: 'major' | 'minor') => void;
    displayKeys: string[];
}

const chordModes: { id: ChordMode; label: string }[] = [
    { id: 'diatonic', label: 'Diatonic' },
    { id: 'major', label: 'Major' },
    { id: 'dominant7', label: 'Dom 7' },
    { id: 'minor', label: 'Minor' },
    { id: 'diminished', label: 'Dim' },
    { id: 'augmented', label: 'Aug' },
];

export const AutoChordsPanel: React.FC<AutoChordsPanelProps> = ({
    isOn, onToggle, mode, onModeChange,
    diatonicKey, onDiatonicKeyChange,
    diatonicScale, onDiatonicScaleChange,
    displayKeys
}) => {
    const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full bg-synth-gray-900 shadow-2xl rounded-xl p-4 flex flex-col gap-4">
        <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex justify-between items-center w-full"
            aria-expanded={isOpen}
            aria-controls="auto-chords-content"
        >
            <h3 className="text-lg font-semibold text-white">Auto Chords</h3>
            <ChevronDownIcon className={`w-6 h-6 text-synth-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <div
            id="auto-chords-content"
            className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
        >
            <div className="pt-4 border-t border-synth-gray-700/50 flex flex-col gap-4">
                 <div className="flex justify-between items-center">
                    <label htmlFor="auto-chords-toggle" className="text-sm text-synth-gray-500">
                        Enable Auto Chords
                    </label>
                    <label className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                id="auto-chords-toggle" 
                                className="sr-only" 
                                checked={isOn} 
                                onChange={(e) => onToggle(e.target.checked)}
                            />
                            <div className={`block w-14 h-8 rounded-full transition-colors ${isOn ? 'bg-synth-purple-500' : 'bg-synth-gray-700'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isOn ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                    </label>
                </div>

                <div className={`grid grid-cols-3 md:grid-cols-6 gap-2 transition-opacity duration-300 ${!isOn ? 'opacity-40 pointer-events-none' : ''}`}>
                    {chordModes.map(({ id, label }) => (
                        <button
                            key={id}
                            onClick={() => onModeChange(id)}
                            disabled={!isOn}
                            className={`p-2 rounded-md cursor-pointer transition-colors text-center text-sm
                                ${mode === id ? 'bg-synth-cyan-500 text-synth-gray-900 font-bold' : 'bg-synth-gray-800 hover:bg-synth-gray-700'}
                            `}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {mode === 'diatonic' && (
                    <div className={`bg-synth-gray-800 p-3 rounded-lg flex items-center justify-center gap-4 transition-all duration-300 ${!isOn ? 'opacity-40 pointer-events-none' : ''}`}>
                        <span className="text-sm font-medium text-synth-gray-500">Key:</span>
                        <select 
                            value={diatonicKey} 
                            onChange={e => onDiatonicKeyChange(e.target.value)}
                            disabled={!isOn}
                            className="bg-synth-gray-700 text-white rounded-md p-2 text-sm focus:ring-2 focus:ring-synth-cyan-500 outline-none"
                            aria-label="Select diatonic key"
                        >
                            {displayKeys.map(key => <option key={key} value={key}>{key}</option>)}
                        </select>

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => onDiatonicScaleChange('major')} 
                                disabled={!isOn}
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${diatonicScale === 'major' ? 'bg-synth-cyan-400 text-synth-gray-900' : 'bg-synth-gray-700 hover:bg-synth-gray-600'}`}
                            >
                                Major
                            </button>
                             <button 
                                onClick={() => onDiatonicScaleChange('minor')} 
                                disabled={!isOn}
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${diatonicScale === 'minor' ? 'bg-synth-cyan-400 text-synth-gray-900' : 'bg-synth-gray-700 hover:bg-synth-gray-600'}`}
                            >
                                Minor
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
