
import React, { useState, useRef, useEffect } from 'react';
import { Tooltip } from './Tooltip';

interface ControlProps {
  label: string;
  value: number;
  defaultValue?: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  showTooltip?: boolean;
  tooltipText?: string;
  logarithmic?: boolean; // For frequency knobs
}

export const SliderControl: React.FC<ControlProps> = ({ label, value, defaultValue, min, max, step, onChange, showTooltip = false, tooltipText }) => {
  const defaultTooltipText = `${label}: ${value.toFixed(2)}`;
  
  const handleDoubleClick = () => {
      if (defaultValue !== undefined) {
          onChange(defaultValue);
      }
  };
  
  return (
    <Tooltip show={showTooltip} text={tooltipText || defaultTooltipText}>
        <div className="flex flex-col items-center justify-end gap-2 h-full" onDoubleClick={handleDoubleClick}>
          <div className="relative flex-grow w-full flex items-center justify-center min-h-[100px]">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              className="slider-rotated"
              aria-label={label}
              style={{
                  '--thumb-color': 'rgb(var(--accent-500))',
                  '--track-color': '#2A2A2A'
              } as React.CSSProperties}
            />
          </div>
          <div className="flex flex-col items-center">
            <label className="text-xs font-medium text-synth-gray-500 whitespace-nowrap cursor-pointer select-none">{label}</label>
            <span className="text-xs font-mono text-white bg-synth-gray-700 px-2 py-0.5 rounded cursor-pointer select-none">
              {value.toFixed(2)}
            </span>
          </div>
        </div>
    </Tooltip>
  );
};

export const RotaryKnob: React.FC<ControlProps> = ({ label, value, defaultValue, min, max, step, onChange, showTooltip = false, tooltipText, logarithmic }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startYRef = useRef<number>(0);
    const startValueRef = useRef<number>(0);
    
    // Calculate rotation (-135 to 135 degrees)
    let percentage = 0;
    if (logarithmic) {
        const minLog = Math.log(min || 1); // Avoid log(0)
        const maxLog = Math.log(max);
        const valLog = Math.log(value || 1);
        percentage = (valLog - minLog) / (maxLog - minLog);
    } else {
        percentage = (value - min) / (max - min);
    }
    const rotation = -135 + (percentage * 270);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        startYRef.current = e.clientY;
        startValueRef.current = value;
        document.body.style.cursor = 'ns-resize';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
        const deltaY = startYRef.current - e.clientY;
        const sensitivity = 200; // Pixels for full range
        const deltaPercent = deltaY / sensitivity;
        
        let newValue;
        if (logarithmic) {
             const minLog = Math.log(min || 1);
             const maxLog = Math.log(max);
             // Calculate current position in log scale (0-1)
             const currentLogPos = (Math.log(startValueRef.current || 1) - minLog) / (maxLog - minLog);
             const newLogPos = Math.max(0, Math.min(1, currentLogPos + deltaPercent));
             newValue = Math.exp(minLog + newLogPos * (maxLog - minLog));
        } else {
             const range = max - min;
             newValue = Math.max(min, Math.min(max, startValueRef.current + (deltaPercent * range)));
        }
        
        // Quantize to step
        if (!logarithmic) {
             newValue = Math.round(newValue / step) * step;
        }

        onChange(newValue);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
    
    const handleDoubleClick = () => {
        if (defaultValue !== undefined) {
            onChange(defaultValue);
        }
    };
    
    // Format Display Value
    let displayValue = value.toFixed(step < 1 ? 2 : 0);
    if (value >= 1000) displayValue = (value / 1000).toFixed(1) + 'k';

    const defaultTooltipText = `${label}: ${displayValue}`;

    return (
        <Tooltip show={showTooltip} text={tooltipText || defaultTooltipText}>
            <div className="flex flex-col items-center gap-2 select-none group" onDoubleClick={handleDoubleClick}>
                <div 
                    className="relative w-12 h-12 cursor-ns-resize"
                    onMouseDown={handleMouseDown}
                >
                    {/* Ring Background */}
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                        <path 
                            d="M 20 80 A 40 40 0 1 1 80 80" 
                            fill="none" 
                            stroke="#1E1E1E" 
                            strokeWidth="10" 
                            strokeLinecap="round" 
                        />
                        {/* Value Arc */}
                        <path 
                            d="M 20 80 A 40 40 0 1 1 80 80" 
                            fill="none" 
                            stroke={`rgb(var(--accent-500))`} 
                            strokeWidth="10" 
                            strokeLinecap="round"
                            strokeDasharray="251.2"
                            strokeDashoffset={251.2 * (1 - percentage)}
                            className="transition-all duration-75"
                        />
                    </svg>
                    
                    {/* Knob Cap */}
                    <div 
                        className="absolute top-1/2 left-1/2 w-8 h-8 bg-synth-gray-700 rounded-full border-2 border-synth-gray-600 shadow-md transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center group-hover:border-[rgb(var(--accent-500))] transition-colors"
                        style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
                    >
                        <div className="w-1 h-3 bg-white rounded-full -mt-3 shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
                    </div>
                </div>
                
                <div className="flex flex-col items-center">
                    <label className="text-[10px] font-bold text-synth-gray-500 uppercase tracking-wider cursor-pointer">{label}</label>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${isDragging ? 'bg-[rgb(var(--accent-500))] text-synth-gray-900' : 'text-synth-gray-400 bg-black/20'}`}>
                        {displayValue}
                    </span>
                </div>
            </div>
        </Tooltip>
    );
};
