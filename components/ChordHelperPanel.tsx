

import React, { useState } from 'react';
import type { ChordMode } from '../types';
import { ChevronDownIcon } from './icons';
import { getDiatonicChordInfo } from '../services/musicTheory';

interface ChordToolsPanelProps {
    autoChordsOn: boolean;
    onToggleAutoChords: (isOn: boolean) => void;
    chordMode: ChordMode;
    onModeChange: (mode: ChordMode) => void;
    diatonicScale: 'major' | 'minor';
    onDiatonicScaleChange: (scale: 'major' | 'minor') => void;
    
    chordHelperOn: boolean;
    onToggleChordHelper: (isOn: boolean) => void;
    
    selectedKey: string;
    onKeyChange: (key: string) => void;
    
    displayKeys: string[];
    preferFlats: boolean;
}

const chordModes: { id: ChordMode; label: string }[] = [
    { id: 'diatonic', label: 'Diatonic' },
    { id: 'major', label: 'Major' },
    { id: 'dominant7', label: 'Dom 7' },
    { id: 'minor', label: 'Minor' },
    { id: 'diminished', label: 'Dim' },
    { id: 'augmented', label: 'Aug' },
];


const ChordFunctionCard: React.FC<{
    roman: string;
    chordName: string;
    functionName: string;
    description: string;
    colorClass: string;
}> = ({ roman, chordName, functionName, description, colorClass }) => (
    <div className="bg-synth-gray-800 p-3 rounded-lg text-center flex flex-col h-full">
        <div className="flex items-center justify-center gap-2">
            <div className={`w-4 h-4 rounded-full ${colorClass}`}></div>
            <h5 className="font-bold text-white"><span className="normal-case">{roman}</span> <span className="text-synth-gray-500 font-normal">({chordName})</span></h5>
        </div>
        <span className="text-xs text-synth-cyan-400 mt-1">{functionName}</span>
        <p className="text-xs text-gray-400 mt-2 flex-grow">{description}</p>
    </div>
);

const ROMAN_COLORS: { [key: string]: string } = {
    'I': 'text-blue-500',
    'IV': 'text-green-500',
    'V': 'text-yellow-500',
    'vi': 'text-purple-500',
};

const Progression: React.FC<{ progression: string, description: string }> = ({ progression, description }) => {
    const parts = progression.split(' ');
    return (
        <p>
            <span className="font-mono">
                {parts.map((part, index) => (
                    <React.Fragment key={index}>
                        <span className={`${ROMAN_COLORS[part] || 'text-white'} normal-case`}>{part}</span>
                        {index < parts.length - 1 ? ' - ' : ''}
                    </React.Fragment>
                ))}
            </span>
            <span className="text-gray-400">: {description}</span>
        </p>
    );
};


export const ChordHelperPanel: React.FC<ChordToolsPanelProps> = ({
    autoChordsOn, onToggleAutoChords, chordMode, onModeChange, diatonicScale, onDiatonicScaleChange,
    chordHelperOn, onToggleChordHelper,
    selectedKey, onKeyChange,
    displayKeys, preferFlats,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'autoChords' | 'helper'>('autoChords');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // --- Chord Data Calculation ---
    const allChords = [
        getDiatonicChordInfo(selectedKey, 1, preferFlats),
        getDiatonicChordInfo(selectedKey, 2, preferFlats),
        getDiatonicChordInfo(selectedKey, 3, preferFlats),
        getDiatonicChordInfo(selectedKey, 4, preferFlats),
        getDiatonicChordInfo(selectedKey, 5, preferFlats),
        getDiatonicChordInfo(selectedKey, 6, preferFlats),
        getDiatonicChordInfo(selectedKey, 7, preferFlats)
    ].filter((c): c is NonNullable<typeof c> => c !== null);

    const primaryRomanNumerals = ['I', 'IV', 'V', 'vi'];
    const primaryChords = allChords.filter(c => primaryRomanNumerals.includes(c.roman));

    const chordsToRender = showAdvanced ? allChords : primaryChords;
    
    const chordDetailsMap: { [key: string]: { functionName: string; description: string; colorClass: string; } } = {
        'I': { functionName: 'Tonic', description: 'The \'home\' chord. Provides stability and resolution.', colorClass: 'bg-blue-500' },
        'ii': { functionName: 'Supertonic', description: 'A minor chord that smoothly leads to the V chord.', colorClass: 'bg-teal-500' },
        'iii': { functionName: 'Mediant', description: 'A minor chord that can lead to IV or vi.', colorClass: 'bg-orange-500' },
        'IV': { functionName: 'Subdominant', description: 'Builds moderate tension, often leading to V.', colorClass: 'bg-green-500' },
        'V': { functionName: 'Dominant', description: 'Maximum tension. Strongly pulls back to the \'home\' I chord.', colorClass: 'bg-yellow-500' },
        'vi': { functionName: 'Submediant', description: 'A minor chord with a melancholic feel. Often acts as a substitute for I.', colorClass: 'bg-purple-500' },
        'vii°': { functionName: 'Leading-Tone', description: 'A diminished chord with a very strong pull to resolve to I.', colorClass: 'bg-slate-500' },
    };

    return (
        <div className="w-full bg-synth-gray-900 shadow-2xl rounded-xl p-4 flex flex-col gap-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex justify-between items-center w-full"
                aria-expanded={isOpen}
                aria-controls="chord-tools-content"
            >
                <h3 className="text-lg font-semibold text-white">Chord Tools</h3>
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span> I
                        <span className="w-3 h-3 rounded-full bg-green-500"></span> IV
                        <span className="w-3 h-3 rounded-full bg-yellow-500"></span> V
                        <span className="w-3 h-3 rounded-full bg-purple-500"></span> vi
                    </div>
                    <ChevronDownIcon className={`w-6 h-6 text-synth-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>
            
            <div
                id="chord-tools-content"
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
                <div className="pt-4 border-t border-synth-gray-700/50 flex flex-col gap-4">
                     <div className="bg-synth-gray-800 p-3 rounded-lg flex items-center justify-center gap-4">
                        <span className="text-sm font-medium text-synth-gray-500">Key:</span>
                        <select 
                            value={selectedKey} 
                            onChange={e => onKeyChange(e.target.value)}
                            className="bg-synth-gray-700 text-white rounded-md p-2 text-sm focus:ring-2 focus:ring-synth-cyan-500 outline-none"
                            aria-label="Select musical key"
                        >
                            {displayKeys.map(key => <option key={key} value={key}>{key}</option>)}
                        </select>
                    </div>

                    <div className="flex bg-synth-gray-800 rounded-lg p-1">
                        <button
                            onClick={() => setActiveTab('autoChords')}
                            className={`flex-1 p-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'autoChords' ? 'bg-synth-purple-500 text-white' : 'hover:bg-synth-gray-700'}`}
                        >
                            Auto Chords
                        </button>
                        <button
                            onClick={() => setActiveTab('helper')}
                            className={`flex-1 p-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'helper' ? 'bg-synth-purple-500 text-white' : 'hover:bg-synth-gray-700'}`}
                        >
                            Chord Helper
                        </button>
                    </div>

                    {activeTab === 'autoChords' && (
                        <div className="flex flex-col gap-4">
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
                                            checked={autoChordsOn} 
                                            onChange={(e) => onToggleAutoChords(e.target.checked)}
                                        />
                                        <div className={`block w-14 h-8 rounded-full transition-colors ${autoChordsOn ? 'bg-synth-cyan-500' : 'bg-synth-gray-700'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${autoChordsOn ? 'transform translate-x-6' : ''}`}></div>
                                    </div>
                                </label>
                            </div>
                            <div className={`grid grid-cols-3 md:grid-cols-6 gap-2 transition-opacity duration-300 ${!autoChordsOn ? 'opacity-40 pointer-events-none' : ''}`}>
                                {chordModes.map(({ id, label }) => (
                                    <button
                                        key={id}
                                        onClick={() => onModeChange(id)}
                                        disabled={!autoChordsOn}
                                        className={`p-2 rounded-md cursor-pointer transition-colors text-center text-sm
                                            ${chordMode === id ? 'bg-synth-cyan-500 text-synth-gray-900 font-bold' : 'bg-synth-gray-800 hover:bg-synth-gray-700'}
                                        `}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {chordMode === 'diatonic' && (
                                <div className={`bg-synth-gray-800 p-3 rounded-lg flex items-center justify-center gap-4 transition-all duration-300 ${!autoChordsOn ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <span className="text-sm font-medium text-synth-gray-500">Scale:</span>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => onDiatonicScaleChange('major')} 
                                            disabled={!autoChordsOn}
                                            className={`px-3 py-1 text-sm rounded-md transition-colors ${diatonicScale === 'major' ? 'bg-synth-cyan-400 text-synth-gray-900' : 'bg-synth-gray-700 hover:bg-synth-gray-600'}`}
                                        >
                                            Major
                                        </button>
                                        <button 
                                            onClick={() => onDiatonicScaleChange('minor')} 
                                            disabled={!autoChordsOn}
                                            className={`px-3 py-1 text-sm rounded-md transition-colors ${diatonicScale === 'minor' ? 'bg-synth-cyan-400 text-synth-gray-900' : 'bg-synth-gray-700 hover:bg-synth-gray-600'}`}
                                        >
                                            Minor
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'helper' && (
                        <div className="flex flex-col gap-4">
                             <div className="flex items-center justify-between">
                                <label htmlFor="chord-helper-toggle-input" className="text-sm text-synth-gray-500">
                                    Enable Chord Highlighting
                                </label>
                                <label className="flex items-center cursor-pointer">
                                    <div className="relative">
                                        <input 
                                            type="checkbox" 
                                            id="chord-helper-toggle-input" 
                                            className="sr-only" 
                                            checked={chordHelperOn} 
                                            onChange={(e) => onToggleChordHelper(e.target.checked)}
                                        />
                                        <div className={`block w-14 h-8 rounded-full transition-colors ${chordHelperOn ? 'bg-synth-cyan-500' : 'bg-synth-gray-700'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${chordHelperOn ? 'transform translate-x-6' : ''}`}></div>
                                    </div>
                                </label>
                            </div>
                            <div className={`mt-2 flex flex-col lg:flex-row gap-4 transition-opacity duration-300 ${!chordHelperOn ? 'opacity-40 pointer-events-none' : ''}`}>
                                <div className="flex-1 space-y-3">
                                    <h4 className="font-semibold text-center text-white">Chord Functions</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {chordsToRender.map((chord) => {
                                            const details = chordDetailsMap[chord.roman];
                                            if (!details) return null;
                                            return (
                                                <ChordFunctionCard
                                                    key={chord.roman}
                                                    roman={chord.roman}
                                                    chordName={chord.name}
                                                    functionName={details.functionName}
                                                    description={details.description}
                                                    colorClass={details.colorClass}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center justify-end pt-2">
                                        <label htmlFor="advanced-chords-toggle" className="flex items-center cursor-pointer">
                                            <span className="text-sm text-synth-gray-500 mr-3">Show Advanced</span>
                                            <input 
                                                type="checkbox" 
                                                id="advanced-chords-toggle" 
                                                className="w-5 h-5 rounded bg-synth-gray-700 border-synth-gray-600 text-synth-cyan-500 focus:ring-2 focus:ring-offset-2 focus:ring-offset-synth-gray-900 focus:ring-synth-cyan-500 cursor-pointer"
                                                checked={showAdvanced}
                                                onChange={(e) => setShowAdvanced(e.target.checked)}
                                            />
                                        </label>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-3">
                                    <h4 className="font-semibold text-center text-white">Common Progressions</h4>
                                    <div className="bg-synth-gray-800 p-3 rounded-lg text-sm space-y-2">
                                        <Progression progression="I IV V I" description="The most fundamental progression in Western music." />
                                        <Progression progression="I V vi IV" description="A hugely popular progression found in countless hit songs." />
                                        <Progression progression="vi IV I V" description="A common, emotional progression often used in ballads." />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
