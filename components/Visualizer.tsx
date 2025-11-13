import React from 'react';
import { Oscilloscope } from './Oscilloscope';

interface VisualizerProps {
  analyserX: AnalyserNode | null;
}

export const Visualizer: React.FC<VisualizerProps> = ({ analyserX }) => {
    return (
        <div className="w-full h-24 mt-2 bg-black/50 rounded-lg border-2 border-synth-gray-700/50 shadow-inner overflow-hidden p-1 box-border">
            <div className="w-full h-full bg-black rounded-sm">
                {analyserX && <Oscilloscope analyser={analyserX} />}
            </div>
        </div>
    );
};