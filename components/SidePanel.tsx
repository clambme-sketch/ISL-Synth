import React from 'react';

interface SidePanelProps {
    octaveOffset: number;
    onOctaveChange: (offset: number) => void;
    pitchBend: number;
    maxPitchBend: number;
    sustainOn: boolean;
}

const OCTAVE_COLORS = [
    'bg-red-500', 
    'bg-orange-500', 
    'bg-yellow-500', 
    'bg-green-500', 
    'bg-blue-500'
];

export const SidePanel: React.FC<SidePanelProps> = ({
    octaveOffset,
    onOctaveChange,
    pitchBend,
    maxPitchBend,
    sustainOn,
}) => {
    const bendPercentage = (pitchBend / maxPitchBend) * 100;

    return (
        <div className="bg-synth-gray-900 p-4 rounded-xl flex flex-col gap-6 w-48 flex-shrink-0">
            {/* Octave Control */}
            <div className="flex flex-col items-center gap-3">
                <span className="text-xs font-medium text-synth-gray-500 tracking-wider">OCTAVE</span>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => onOctaveChange(Math.max(-2, octaveOffset - 1))}
                        className="w-8 h-8 rounded-full bg-synth-gray-700 text-white font-bold text-xl hover:bg-synth-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={octaveOffset <= -2}
                        aria-label="Decrease octave"
                    >
                        -
                    </button>
                    <div className="flex justify-center items-center gap-1.5">
                        {[-2, -1, 0, 1, 2].map(oct => {
                            const isActive = oct === octaveOffset;
                            const colorClass = OCTAVE_COLORS[oct + 2];
                            return (
                                <div 
                                    key={oct}
                                    onClick={() => onOctaveChange(oct)}
                                    role="button"
                                    aria-pressed={isActive}
                                    tabIndex={0}
                                    onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') onOctaveChange(oct);}}
                                    aria-label={`Set octave to ${oct > 0 ? '+' : ''}${oct}`}
                                    className={`w-4 h-4 rounded-full transition-all duration-200 border-2 border-transparent cursor-pointer
                                        ${isActive 
                                            ? `${colorClass} shadow-[0_0_8px_2px_rgba(255,255,255,0.2)] border-white/50` 
                                            : 'bg-synth-gray-700 hover:bg-synth-gray-600'
                                        }`
                                    }
                                ></div>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => onOctaveChange(Math.min(2, octaveOffset + 1))}
                        className="w-8 h-8 rounded-full bg-synth-gray-700 text-white font-bold text-xl hover:bg-synth-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={octaveOffset >= 2}
                        aria-label="Increase octave"
                    >
                        +
                    </button>
                </div>
            </div>

            {/* Pitch Wheel */}
            <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-synth-gray-500 tracking-wider">PITCH</span>
                <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl font-mono text-synth-gray-600" aria-hidden="true">-</span>
                    <div className="relative w-16 h-24 bg-synth-gray-800 rounded-lg shadow-inner overflow-hidden mx-auto border border-black">
                        <div 
                            className="absolute top-1/2 left-1/2 w-12 h-12 bg-gradient-to-b from-gray-600 to-black rounded-full border-2 border-gray-900 transition-transform duration-100 ease-out flex items-center justify-center"
                            style={{
                                transform: `translateX(-50%) translateY(calc(-50% - ${bendPercentage * 0.3}px))`
                            }}
                        >
                            <div className="absolute inset-1 border-2 border-gray-700 rounded-full"></div>
                            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
                        </div>
                    </div>
                    <span className="text-2xl font-mono text-synth-gray-600" aria-hidden="true">+</span>
                </div>
            </div>

            {/* Sustain Indicator */}
            <div className="flex flex-col items-center gap-2 pt-2 border-t border-synth-gray-700/50">
                <span className="text-xs font-medium text-synth-gray-500 tracking-wider">SUSTAIN</span>
                <div className={`w-5 h-5 rounded-full border-2 border-black/50 transition-all duration-150
                    ${sustainOn
                        ? 'bg-synth-cyan-500 shadow-[0_0_10px_2px_rgba(0,255,255,0.7)]'
                        : 'bg-synth-gray-700 shadow-inner'
                    }`}
                ></div>
                <span className="text-xs font-mono text-synth-gray-600 mt-1">(SPACEBAR)</span>
            </div>
        </div>
    );
};