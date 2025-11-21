
import React, { useState } from 'react';
import { Oscilloscope } from './Oscilloscope';
import { SpectrumAnalyzer } from './SpectrumAnalyzer';

interface VisualizerProps {
  analyserX: AnalyserNode | null;
}

export const Visualizer: React.FC<VisualizerProps> = ({ analyserX }) => {
    const [mode, setMode] = useState<'scope' | 'spectrum'>('spectrum');

    return (
        <div className="relative w-full h-32 mt-2 bg-black/50 rounded-lg border-2 border-synth-gray-700/50 shadow-inner overflow-hidden p-1 box-border group">
            <div className="w-full h-full bg-black rounded-sm relative">
                {analyserX && (
                    mode === 'scope' ? <Oscilloscope analyser={analyserX} /> : <SpectrumAnalyzer analyser={analyserX} />
                )}
            </div>
            
            {/* Mode Toggle Button */}
            <button
                onClick={() => setMode(m => m === 'scope' ? 'spectrum' : 'scope')}
                className="absolute top-2 right-2 px-2 py-1 bg-synth-gray-800/80 hover:bg-synth-gray-700 text-white text-[10px] font-bold uppercase tracking-wider rounded border border-synth-gray-600 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
                {mode === 'scope' ? 'Spectrum' : 'Scope'}
            </button>
        </div>
    );
};
