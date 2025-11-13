
import React, { useState } from 'react';
import type { LFOSettings, WaveformType, LFOTarget } from '../types';
import { ChevronDownIcon, WaveformIcon } from './icons';
import { SliderControl } from './Knob';

interface LFOPanelProps {
  settings: LFOSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<LFOSettings>>;
  showTooltips: boolean;
}

const RadioPill: React.FC<{
    options: { value: string; label: string }[];
    selectedValue: string;
    onChange: (value: string) => void;
    name: string;
}> = ({ options, selectedValue, onChange, name }) => (
    <div className="flex bg-synth-gray-700 rounded-full p-1">
        {options.map(({ value, label }) => (
            <label key={value} className="flex-1 text-center">
                <input
                    type="radio"
                    name={name}
                    value={value}
                    checked={selectedValue === value}
                    onChange={() => onChange(value)}
                    className="sr-only"
                />
                <span className={`px-3 py-1 text-xs rounded-full cursor-pointer transition-colors block ${
                    selectedValue === value ? 'bg-synth-purple-500 text-white font-bold' : 'text-synth-gray-500 hover:bg-synth-gray-600'
                }`}>
                    {label}
                </span>
            </label>
        ))}
    </div>
);


export const LFOPanel: React.FC<LFOPanelProps> = ({ settings, onSettingsChange, showTooltips }) => {
  const [isOpen, setIsOpen] = useState(false);
  const waveforms: WaveformType[] = ['sine', 'square', 'sawtooth', 'triangle'];
  const targets: { id: LFOTarget, label: string }[] = [
    { id: 'pitch', label: 'Pitch' },
    { id: 'filter', label: 'Filter' },
    { id: 'amplitude', label: 'Amp' },
  ];

  const handleToggle = (checked: boolean) => {
    onSettingsChange(p => ({ ...p, on: checked }));
  };

  const handleChange = (param: keyof Omit<LFOSettings, 'on'>) => (value: any) => {
    onSettingsChange(p => ({ ...p, [param]: value }));
  };
  
  const handleSliderChange = (param: 'rate' | 'depth') => (value: number) => {
      onSettingsChange(p => ({ ...p, [param]: value }));
  }

  return (
    <div className="bg-synth-gray-800 p-4 rounded-lg">
        <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex justify-between items-center w-full"
            aria-expanded={isOpen}
            aria-controls="lfo-content"
        >
            <h3 className="text-lg font-semibold text-white">LFO (Low-Frequency Oscillator)</h3>
            <ChevronDownIcon className={`w-6 h-6 text-synth-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        <div
            id="lfo-content"
            className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100 pt-4 mt-4 border-t border-synth-gray-700/50' : 'max-h-0 opacity-0'}`}
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="flex flex-col gap-4">
                     <label className="flex items-center cursor-pointer justify-between">
                        <span className="text-sm text-synth-gray-500 mr-3">Enable LFO</span>
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                id="lfo-toggle"
                                className="sr-only" 
                                checked={settings.on} 
                                onChange={(e) => handleToggle(e.target.checked)}
                            />
                            <div className={`block w-12 h-6 rounded-full transition-colors ${settings.on ? 'bg-synth-cyan-500' : 'bg-synth-gray-700'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.on ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                    </label>
                    <div className={`transition-opacity duration-300 ${!settings.on ? 'opacity-40 pointer-events-none' : ''}`}>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium text-synth-gray-500 block mb-2">Waveform</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {waveforms.map(wave => (
                                    <label key={wave} className={`p-2 rounded-md cursor-pointer transition-colors flex items-center justify-center gap-2 ${settings.waveform === wave ? 'bg-synth-purple-500 text-white' : 'bg-synth-gray-700 hover:bg-synth-gray-600'}`}>
                                        <input type="radio" name="lfo-waveform" value={wave} checked={settings.waveform === wave} onChange={() => handleChange('waveform')(wave)} className="sr-only" />
                                        <WaveformIcon type={wave} className="w-6 h-4" />
                                        <span>{wave}</span>
                                    </label>
                                    ))}
                                </div>
                            </div>
                             <div>
                                <label className="text-sm font-medium text-synth-gray-500 block mb-2">Target</label>
                                <RadioPill name="lfo-target" options={targets.map(t => ({ value: t.id, label: t.label }))} selectedValue={settings.target} onChange={handleChange('target')} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`transition-opacity duration-300 ${!settings.on ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div className="grid grid-cols-2 gap-4 h-40">
                        <SliderControl label="Rate" value={settings.rate} min={0.1} max={20} step={0.1} onChange={handleSliderChange('rate')} showTooltip={showTooltips} tooltipText={`Rate: ${settings.rate.toFixed(1)} Hz`} />
                        <SliderControl label="Depth" value={settings.depth} min={0} max={1} step={0.01} onChange={handleSliderChange('depth')} showTooltip={showTooltips} tooltipText={`Depth: ${(settings.depth * 100).toFixed(0)}%`} />
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
