
import React from 'react';
import type { ADSREnvelope } from '../types';

interface EnvelopeVisualizerProps {
  adsr: ADSREnvelope;
}

// This represents an arbitrary time for the sustain portion to be drawn,
// ensuring it's always visible in the graph.
const SUSTAIN_HOLD_DURATION = 0.5;

export const EnvelopeVisualizer: React.FC<EnvelopeVisualizerProps> = ({ adsr }) => {
  const { attack, decay, sustain, release } = adsr;

  // Dynamically calculate the total duration for scaling based on current values.
  const totalDuration = attack + decay + SUSTAIN_HOLD_DURATION + release + 1e-6;
  
  const width = 200;
  const height = 60;

  // Calculate X coordinates
  const attackX = (attack / totalDuration) * width;
  const decayX = ((attack + decay) / totalDuration) * width;
  const sustainX = ((attack + decay + SUSTAIN_HOLD_DURATION) / totalDuration) * width;
  const releaseX = width; 

  // Calculate Y coordinates (inverted)
  const sustainY = height - (sustain * height);

  const pathData = `
    M 0,${height}
    L ${attackX},0
    L ${decayX},${sustainY}
    L ${sustainX},${sustainY}
    L ${releaseX},${height}
  `;

  // Position labels
  const labelY = height + 12;
  const attackLabelX = attackX / 2;
  const decayLabelX = attackX + (decayX - attackX) / 2;
  const sustainLabelX = decayX + (sustainX - decayX) / 2;
  const releaseLabelX = sustainX + (releaseX - sustainX) / 2;

  return (
    <div className="bg-black rounded-sm p-2 select-none">
      <svg viewBox={`0 -2 ${width} ${height + 16}`} className="w-full h-auto">
        {/* Background dotted line for sustain level */}
        <line 
            x1="0" y1={sustainY} x2={sustainX} y2={sustainY} 
            stroke="#3D3D3D" strokeWidth="1" strokeDasharray="2,2" 
        />
        
        {/* Envelope Path with glow using modern RGB syntax for opacity */}
        <path 
            d={pathData} 
            stroke="rgb(var(--accent-500))" 
            strokeWidth="2" 
            fill="rgb(var(--accent-500) / 0.15)" 
        />
        
        {/* Vertical separator lines */}
        <line x1={attackX} y1="0" x2={attackX} y2={height} stroke="#3D3D3D" strokeWidth="0.5" />
        <line x1={sustainX} y1={sustainY} x2={sustainX} y2={height} stroke="#3D3D3D" strokeWidth="0.5" />
        
        {/* Stage Labels */}
        <text x={attackLabelX} y={labelY} fill="#8A8A8A" fontSize="9" textAnchor="middle" fontFamily="monospace">A</text>
        <text x={decayLabelX} y={labelY} fill="#8A8A8A" fontSize="9" textAnchor="middle" fontFamily="monospace">D</text>
        <text x={sustainLabelX} y={labelY} fill="#8A8A8A" fontSize="9" textAnchor="middle" fontFamily="monospace">S</text>
        <text x={releaseLabelX} y={labelY} fill="#8A8A8A" fontSize="9" textAnchor="middle" fontFamily="monospace">R</text>
      </svg>
    </div>
  );
};
