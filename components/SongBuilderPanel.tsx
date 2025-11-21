
import React, { useState } from 'react';
import { ChevronDownIcon, PlayIcon, StopIcon, TrashIcon } from './icons';
import type { SongMeasure, SongPattern } from '../types';
import { Tooltip } from './Tooltip';

interface SongBuilderPanelProps {
    patterns: SongPattern[];
    activePatternIndex: number;
    onPatternChange: (index: number) => void;
    onPatternAdd: () => void;
    onPatternDelete: (index: number) => void;
    onSequenceChange: (newSequence: SongMeasure[]) => void;
    isPlaying: boolean;
    onPlayPause: () => void;
    onClear: () => void;
    currentMeasureIndex: number;
    musicKey: string;
    onKeyChange: (key: string) => void;
    scale: 'major' | 'minor';
    onScaleChange: (scale: 'major' | 'minor') => void;
    showTooltips: boolean;
    displayKeys: string[];
    isMetronomePlaying: boolean;
    onToggleMetronome: () => void;
}

// Strictly typed palettes for drag source
const AVAILABLE_CHORDS_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const AVAILABLE_CHORDS_MINOR = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

export const SongBuilderPanel: React.FC<SongBuilderPanelProps> = ({
    patterns,
    activePatternIndex,
    onPatternChange,
    onPatternAdd,
    onPatternDelete,
    onSequenceChange,
    isPlaying,
    onPlayPause,
    onClear,
    currentMeasureIndex,
    musicKey,
    onKeyChange,
    scale,
    onScaleChange,
    showTooltips,
    displayKeys,
    isMetronomePlaying,
    onToggleMetronome
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);
    const [draggedChord, setDraggedChord] = useState<string | null>(null);

    const activePattern = patterns[activePatternIndex];
    const songSequence = activePattern.sequence;
    
    // Palette Selection
    const romanPalette = scale === 'major' ? AVAILABLE_CHORDS_MAJOR : AVAILABLE_CHORDS_MINOR;

    const handleDragStart = (e: React.DragEvent, chord: string) => {
        setDraggedChord(chord);
        e.dataTransfer.effectAllowed = 'copy';
        const el = e.currentTarget as HTMLElement;
        el.style.opacity = '0.5';
    };

    const handleDragEnd = (e: React.DragEvent) => {
        setDraggedChord(null);
        const el = e.currentTarget as HTMLElement;
        el.style.opacity = '1';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (measureIndex: number, slotIndex: number) => {
        if (draggedChord) {
            const newSeq = [...songSequence];
            // Ensure we copy properly
            const measure = newSeq[measureIndex];
            const newChords = [...measure.chords];
            
            if (slotIndex < newChords.length) {
                newChords[slotIndex] = draggedChord;
                newSeq[measureIndex] = { ...measure, chords: newChords };
                onSequenceChange(newSeq);
            }
        }
    };
    
    const handleSlotClick = (measureIndex: number, slotIndex: number) => {
        if (!draggedChord) {
             const newSeq = [...songSequence];
             const measure = newSeq[measureIndex];
             const newChords = [...measure.chords];
             
             if (slotIndex < newChords.length && newChords[slotIndex]) {
                 newChords[slotIndex] = null;
                 newSeq[measureIndex] = { ...measure, chords: newChords };
                 onSequenceChange(newSeq);
             }
        }
    };
    
    const handleMeasureDoubleClick = (measureIndex: number) => {
        if (!isAdvancedMode) return;
        
        const newSeq = [...songSequence];
        const measure = newSeq[measureIndex];
        let newChords = [...measure.chords];
        
        if (newChords.length === 1) {
            // Split: [C] -> [C, null]
            newChords = [newChords[0], null];
        } else {
            // Merge: [C, G] -> [C]
            newChords = [newChords[0]];
        }
        
        newSeq[measureIndex] = { ...measure, chords: newChords };
        onSequenceChange(newSeq);
    };

    const addMeasure = () => {
        onSequenceChange([...songSequence, { id: crypto.randomUUID(), chords: [null] }]);
    };

    const removeMeasure = () => {
        if (songSequence.length > 1) {
            onSequenceChange(songSequence.slice(0, -1));
        }
    };

    const renderChromaticRow = (suffix: string, label: string) => (
        <div className="flex flex-col gap-1">
             <span className="text-[10px] text-synth-gray-500 font-bold uppercase tracking-wider px-1">{label}</span>
             <div className="flex flex-wrap gap-2">
                {displayKeys.map(key => {
                    const chordName = `${key}${suffix}`;
                    return (
                        <div
                            key={chordName}
                            draggable
                            onDragStart={(e) => handleDragStart(e, chordName)}
                            onDragEnd={handleDragEnd}
                            className="w-10 h-8 flex items-center justify-center bg-synth-gray-700 hover:bg-synth-gray-600 rounded cursor-grab active:cursor-grabbing text-xs font-bold text-white shadow-sm border border-transparent hover:border-synth-cyan-500 transition-all select-none normal-case"
                        >
                            {chordName}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="w-full bg-synth-gray-900 shadow-2xl rounded-xl p-4 flex flex-col gap-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex justify-between items-center w-full"
                aria-expanded={isOpen}
                aria-controls="song-builder-content"
            >
                <h3 className="text-lg font-semibold text-white">Song Builder</h3>
                <ChevronDownIcon className={`w-6 h-6 text-synth-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <div
                id="song-builder-content"
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'}`}
            >
                <div className="pt-4 border-t border-synth-gray-700/50 flex flex-col gap-4">
                    
                    {/* Pattern Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-synth-gray-600">
                        {patterns.map((pattern, idx) => (
                            <div key={pattern.id} className="flex items-center flex-shrink-0">
                                <button
                                    onClick={() => onPatternChange(idx)}
                                    className={`px-3 py-1.5 text-sm font-bold rounded-l-md transition-colors border-r border-synth-gray-800 ${
                                        idx === activePatternIndex 
                                        ? 'bg-synth-purple-500 text-white' 
                                        : 'bg-synth-gray-700 hover:bg-synth-gray-600 text-gray-300'
                                    }`}
                                >
                                    {pattern.name}
                                </button>
                                <button
                                    onClick={() => onPatternDelete(idx)}
                                    disabled={patterns.length === 1}
                                    className={`px-2 py-1.5 text-sm font-bold rounded-r-md transition-colors ${
                                        idx === activePatternIndex 
                                        ? 'bg-synth-purple-500 text-white hover:bg-red-500' 
                                        : 'bg-synth-gray-700 hover:bg-red-900 text-gray-300'
                                    } disabled:opacity-50 disabled:hover:bg-synth-gray-700 disabled:cursor-not-allowed`}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                        <Tooltip text="Add New Pattern" show={showTooltips}>
                            <button
                                onClick={onPatternAdd}
                                className="px-3 py-1.5 bg-synth-gray-800 hover:bg-synth-gray-700 text-synth-cyan-500 font-bold rounded-md transition-colors border border-synth-gray-600 flex-shrink-0"
                            >
                                +
                            </button>
                        </Tooltip>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row items-center justify-between bg-synth-gray-800 p-2 rounded-lg gap-2">
                        <div className="flex items-center gap-2">
                             <Tooltip text={isPlaying ? "Stop Pattern" : "Play Pattern"} show={showTooltips}>
                                <button
                                    onClick={onPlayPause}
                                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
                                        isPlaying ? 'bg-synth-purple-500 text-white shadow-[0_0_10px_rgba(139,92,246,0.5)]' : 'bg-synth-gray-700 hover:bg-synth-gray-600'
                                    }`}
                                >
                                    {isPlaying ? <StopIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                                </button>
                            </Tooltip>
                            
                            <Tooltip text="Toggle Metronome" show={showTooltips}>
                                <button
                                    onClick={onToggleMetronome}
                                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
                                        isMetronomePlaying ? 'bg-synth-cyan-500 text-synth-gray-900' : 'bg-synth-gray-700 hover:bg-synth-gray-600 text-gray-400 hover:text-white'
                                    }`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${isMetronomePlaying ? 'bg-synth-gray-900 animate-pulse' : 'bg-gray-500'}`}></div>
                                </button>
                            </Tooltip>

                             <Tooltip text="Clear Pattern Grid" show={showTooltips}>
                                <button
                                    onClick={onClear}
                                    disabled={isPlaying}
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-synth-gray-700 hover:bg-synth-gray-600 text-gray-400 hover:text-white disabled:opacity-50"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </Tooltip>
                        </div>
                        
                        {/* Key and Scale Settings */}
                        <div className="flex items-center gap-2 bg-synth-gray-700 px-2 py-1 rounded-lg">
                            <select 
                                value={musicKey} 
                                onChange={e => onKeyChange(e.target.value)}
                                className="bg-transparent text-white text-sm font-bold outline-none cursor-pointer"
                            >
                                {displayKeys.map(key => <option key={key} value={key}>{key}</option>)}
                            </select>
                            
                            <div className="h-4 w-px bg-synth-gray-500"></div>
                            
                             <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => onScaleChange('major')} 
                                    disabled={isAdvancedMode}
                                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                                        scale === 'major' 
                                        ? 'bg-synth-cyan-500 text-synth-gray-900 font-bold' 
                                        : 'text-gray-400 hover:text-white disabled:opacity-30'
                                    }`}
                                >
                                    Maj
                                </button>
                                <button 
                                    onClick={() => onScaleChange('minor')} 
                                    disabled={isAdvancedMode}
                                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                                        scale === 'minor' 
                                        ? 'bg-synth-cyan-500 text-synth-gray-900 font-bold' 
                                        : 'text-gray-400 hover:text-white disabled:opacity-30'
                                    }`}
                                >
                                    Min
                                </button>
                            </div>

                            <div className="h-4 w-px bg-synth-gray-500 mx-1"></div>

                            <label className="flex items-center gap-1 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={isAdvancedMode} 
                                    onChange={(e) => setIsAdvancedMode(e.target.checked)}
                                    className="w-4 h-4 rounded bg-synth-gray-900 border-synth-gray-500 text-synth-cyan-500 focus:ring-0"
                                />
                                <span className="text-xs font-bold text-synth-gray-300">Adv</span>
                            </label>
                        </div>

                        <div className="flex items-center gap-2">
                             <button onClick={removeMeasure} className="px-2 py-1 bg-synth-gray-700 rounded text-xs hover:bg-synth-gray-600 text-white">- Bar</button>
                             <span className="text-xs text-synth-gray-400 font-mono">{songSequence.length} Bars</span>
                             <button onClick={addMeasure} className="px-2 py-1 bg-synth-gray-700 rounded text-xs hover:bg-synth-gray-600 text-white">+ Bar</button>
                        </div>
                    </div>

                    {/* Grid - Now wrapping instead of scrolling */}
                    <div className="w-full pb-2 select-none">
                        <div className="flex flex-wrap gap-2 p-1">
                            {songSequence.map((measure, index) => {
                                const isSplit = measure.chords.length === 2;
                                
                                return (
                                    <div
                                        key={measure.id}
                                        onDoubleClick={() => handleMeasureDoubleClick(index)}
                                        className={`w-24 h-24 rounded-lg border-2 flex relative transition-all flex-shrink-0 overflow-hidden
                                            ${currentMeasureIndex === index && isPlaying 
                                                ? 'border-synth-cyan-500 bg-synth-gray-800 shadow-[0_0_15px_rgba(0,255,255,0.3)]' 
                                                : 'border-synth-gray-700 bg-synth-gray-800/50 hover:border-synth-gray-600 hover:bg-synth-gray-800'
                                            }
                                        `}
                                    >
                                        <span className="absolute top-0 left-1 text-[9px] text-synth-gray-600 font-mono z-10 pointer-events-none">{index + 1}</span>
                                        
                                        {isSplit ? (
                                            <>
                                                {/* Slot 1 */}
                                                <div 
                                                    className="w-1/2 h-full border-r border-synth-gray-700 flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors"
                                                    onDragOver={handleDragOver}
                                                    onDrop={() => handleDrop(index, 0)}
                                                    onClick={(e) => { e.stopPropagation(); handleSlotClick(index, 0); }}
                                                >
                                                     {measure.chords[0] ? (
                                                        <div className="text-sm font-bold text-white normal-case text-center break-words px-1">
                                                            {measure.chords[0]}
                                                        </div>
                                                    ) : (
                                                        <span className="text-synth-gray-700 text-[10px]">Drop</span>
                                                    )}
                                                </div>

                                                {/* Slot 2 */}
                                                <div 
                                                    className="w-1/2 h-full flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors"
                                                    onDragOver={handleDragOver}
                                                    onDrop={() => handleDrop(index, 1)}
                                                    onClick={(e) => { e.stopPropagation(); handleSlotClick(index, 1); }}
                                                >
                                                    {measure.chords[1] ? (
                                                        <div className="text-sm font-bold text-white normal-case text-center break-words px-1">
                                                            {measure.chords[1]}
                                                        </div>
                                                    ) : (
                                                        <span className="text-synth-gray-700 text-[10px]">Drop</span>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                             /* Single Slot */
                                            <div 
                                                className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors"
                                                onDragOver={handleDragOver}
                                                onDrop={() => handleDrop(index, 0)}
                                                onClick={(e) => { e.stopPropagation(); handleSlotClick(index, 0); }}
                                            >
                                                 {measure.chords[0] ? (
                                                    <div className="text-sm font-bold text-white normal-case text-center break-words px-1">
                                                        {measure.chords[0]}
                                                    </div>
                                                ) : (
                                                    <span className="text-synth-gray-700 text-[10px]">Drop</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Palette */}
                    <div className="bg-synth-gray-800 p-3 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                             <p className="text-xs text-synth-gray-500 font-bold uppercase tracking-wider">
                                 {isAdvancedMode ? "Chromatic Palette" : `Chord Palette (${scale})`}
                             </p>
                             {!isAdvancedMode && <span className="text-[10px] text-synth-gray-600">Key: {musicKey}</span>}
                        </div>
                        
                        {isAdvancedMode ? (
                            <div className="flex flex-col gap-4">
                                {renderChromaticRow("", "Major")}
                                {renderChromaticRow("7", "Dominant 7")}
                                {renderChromaticRow("m", "Minor")}
                                {renderChromaticRow("°", "Diminished")}
                            </div>
                        ) : (
                            <div className="flex flex-wrap justify-center gap-2">
                                {romanPalette.map((chord) => (
                                    <div
                                        key={chord}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, chord)}
                                        onDragEnd={handleDragEnd}
                                        className="w-12 h-12 flex items-center justify-center bg-synth-gray-700 hover:bg-synth-gray-600 rounded-lg cursor-grab active:cursor-grabbing text-base font-bold text-white shadow-sm border border-transparent hover:border-synth-cyan-500 transition-all select-none normal-case"
                                    >
                                        {chord}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                </div>
            </div>
        </div>
    );
};
