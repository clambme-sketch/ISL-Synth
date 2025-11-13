
import React from 'react';
import { Tooltip } from './Tooltip';

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  showTooltip?: boolean;
  tooltipText?: string;
}

export const SliderControl: React.FC<SliderControlProps> = ({ label, value, min, max, step, onChange, showTooltip = false, tooltipText }) => {
  const defaultTooltipText = `${label}: ${value.toFixed(2)}`;
  
  return (
    <Tooltip show={showTooltip} text={tooltipText || defaultTooltipText}>
        <div className="flex flex-col items-center justify-end gap-2 h-full">
          <div className="relative flex-grow w-full flex items-center justify-center">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              className="slider-rotated"
              aria-label={label}
            />
          </div>
          <div className="flex flex-col items-center">
            <label className="text-xs font-medium text-synth-gray-500 whitespace-nowrap">{label}</label>
            <span className="text-xs font-mono text-white bg-synth-gray-700 px-2 py-0.5 rounded">
              {value.toFixed(2)}
            </span>
          </div>
        </div>
    </Tooltip>
  );
};