
import React, { useState } from 'react';
import type { SongPattern, ArrangementBlock } from '../types';
import { ChevronDownIcon, PlayIcon, StopIcon, TrashIcon } from './icons';
import { Tooltip } from './Tooltip';

interface ArrangerPanelProps {
    patterns: SongPattern[];
    arrangement: ArrangementBlock[];
    onArrangementChange: (newArrangement: ArrangementBlock[]) => void;
    isPlaying: boolean;
    onPlayPause: () => void;
    onStop: () => void;
    currentBlockIndex: number;
    showTooltips: boolean;
}

// Simple unique ID generator
const generateId = () => Math.random().toString(36).substring(2, 9);

export const ArrangerPanel: React.FC<ArrangerPanelProps> = ({
    patterns,
    arrangement,
    onArrangementChange,
    isPlaying,
    onPlayPause,
    onStop,
    currentBlockIndex,
    showTooltips
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);

    const handleAddPattern = (patternId: string) => {
        const newBlock: ArrangementBlock = {
            id: generateId(),
            patternId: patternId
        };
        onArrangementChange([...arrangement, newBlock]);
    };

    const handleRemoveBlock = (index: number) => {
        const newArrangement = [...arrangement];
        newArrangement.splice(index, 1);
        onArrangementChange(newArrangement);
        if (newArrangement.length === 0 && isPlaying) {
            onStop();
        }
    };

    const handleClearAll = () => {
        onArrangementChange([]);
        onStop();
    };

    // Reordering Logic
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedBlockIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // Set drag image or opacity style here if needed
        (e.currentTarget as HTMLElement).style.opacity = '0.5';
    };

    const handleDragEnd = (e: React.DragEvent) => {
        setDraggedBlockIndex(null);
        (e.currentTarget as HTMLElement).style.opacity = '1';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedBlockIndex === null || draggedBlockIndex === dropIndex) return;

        const newArrangement = [...arrangement];
        const [movedItem] = newArrangement.splice(draggedBlockIndex, 1);
        newArrangement.splice(dropIndex, 0, movedItem);
        
        onArrangementChange(newArrangement);
        setDraggedBlockIndex(null);
    };

    const getPatternName = (id: string) => {
        return patterns.find(p => p.id === id)?.name || 'Unknown Pattern';
    };

    const getTotalBars = () => {
        return arrangement.reduce((acc, block) => {
            const pattern = patterns.find(p => p.id === block.patternId);
            return acc + (pattern?.sequence.length || 0);
        }, 0);
    };

    return (
        <div className="w-full bg-synth-gray-900 shadow-2xl rounded-xl p-4 flex flex-col gap-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex justify-between items-center w-full"
                aria-expanded={isOpen}
                aria-controls="arranger-content"
            >
                <h3 className="text-lg font-semibold text-white">Song Arranger</h3>
                <ChevronDownIcon className={`w-6 h-6 text-synth-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <div
                id="arranger-content"
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[800px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'}`}
            >
                <div className="pt-4 border-t border-synth-gray-700/50 flex flex-col gap-4">
                    
                    {/* Controls Header */}
                    <div className="flex items-center justify-between bg-synth-gray-800 p-2 rounded-lg">
                        <div className="flex items-center gap-2">
                            <Tooltip text={isPlaying ? "Stop Arrangement" : "Play Arrangement"} show={showTooltips}>
                                <button
                                    onClick={onPlayPause}
                                    disabled={arrangement.length === 0}
                                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
                                        isPlaying 
                                        ? 'bg-[rgb(var(--accent-500))] text-synth-gray-900 shadow-[0_0_10px_rgba(var(--accent-500),0.5)]' 
                                        : 'bg-synth-gray-700 hover:bg-synth-gray-600 disabled:opacity-50'
                                    }`}
                                >
                                    {isPlaying ? <StopIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                                </button>
                            </Tooltip>
                            
                            <Tooltip text="Clear Arrangement" show={showTooltips}>
                                <button
                                    onClick={handleClearAll}
                                    disabled={arrangement.length === 0}
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-synth-gray-700 hover:bg-synth-gray-600 text-gray-400 hover:text-white disabled:opacity-50"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </Tooltip>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-mono text-synth-gray-400">Total Bars: {getTotalBars()}</span>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 h-64">
                        {/* Source List (Left) */}
                        <div className="w-full md:w-1/3 bg-synth-gray-800 rounded-lg p-3 flex flex-col gap-2 overflow-y-auto border border-synth-gray-700">
                            <h4 className="text-xs font-bold text-synth-gray-500 uppercase tracking-wider mb-1">Available Patterns</h4>
                            {patterns.map(pattern => (
                                <button
                                    key={pattern.id}
                                    onClick={() => handleAddPattern(pattern.id)}
                                    className="flex items-center justify-between p-3 rounded-md bg-synth-gray-700 hover:bg-synth-gray-600 text-left transition-all border border-transparent hover:border-[rgb(var(--secondary-500))] group"
                                >
                                    <span className="text-sm font-bold text-white">{pattern.name}</span>
                                    <span className="text-xs text-synth-gray-400 group-hover:text-[rgb(var(--secondary-500))] font-mono">
                                        {pattern.sequence.length} Bars
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Timeline (Right) */}
                        <div className="w-full md:w-2/3 bg-black/30 rounded-lg p-3 border-2 border-synth-gray-700 flex flex-col relative overflow-hidden">
                            <h4 className="text-xs font-bold text-synth-gray-500 uppercase tracking-wider mb-2 sticky top-0 bg-transparent z-10 flex justify-between">
                                <span>Song Timeline</span>
                                <span className="text-[9px] font-normal normal-case opacity-50">Drag to reorder</span>
                            </h4>
                            
                            {arrangement.length === 0 ? (
                                <div className="flex-grow flex items-center justify-center text-synth-gray-600 text-sm italic">
                                    Click patterns on the left to build your song
                                </div>
                            ) : (
                                <div className="flex flex-wrap content-start gap-1 overflow-y-auto pr-1 pb-1">
                                    {arrangement.map((block, index) => {
                                        const isCurrent = isPlaying && index === currentBlockIndex;
                                        return (
                                            <div
                                                key={block.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, index)}
                                                onDragEnd={handleDragEnd}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDrop={(e) => handleDrop(e, index)}
                                                className={`
                                                    relative group flex items-center h-12 px-4 rounded-md border cursor-grab active:cursor-grabbing select-none transition-all
                                                    ${isCurrent 
                                                        ? 'bg-[rgba(var(--accent-500),0.2)] border-[rgb(var(--accent-500))] shadow-[0_0_15px_rgba(var(--accent-500),0.3)]' 
                                                        : 'bg-synth-gray-800 border-synth-gray-600 hover:border-synth-gray-400'
                                                    }
                                                `}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={`text-xs font-bold ${isCurrent ? 'text-[rgb(var(--accent-500))]' : 'text-white'}`}>
                                                        {getPatternName(block.patternId)}
                                                    </span>
                                                    <span className="text-[9px] text-synth-gray-500 font-mono mt-0.5">
                                                        #{index + 1}
                                                    </span>
                                                </div>
                                                
                                                {/* Hover Remove Icon */}
                                                <div 
                                                    className="absolute inset-0 bg-red-900/80 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveBlock(index); }}
                                                >
                                                    <TrashIcon className="w-4 h-4 text-white" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
