
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

  const handleToggle = (param: 'on' | 'retrigger' | 'keySync') => (checked: boolean) => {
    onSettingsChange(p => ({ ...p, [param]: checked }));
  };

  const handleChange = (param: keyof Omit<LFOSettings, 'on' | 'retrigger' | 'keySync'>) => (value: any) => {
    onSettingsChange(p => ({ ...p, [param]: value }));
  };
  
  const handleSliderChange = (param: 'rate' | 'depth') => (value: number) => {
      onSettingsChange(p => ({ ...p, [param]: value }));
  }

  // Adjust Slider Params based on Mode
  const isKeySync = settings.keySync;
  const rateLabel = isKeySync ? "Ratio" : "Rate";
  const rateMin = isKeySync ? 0.5 : 0.1;
  const rateMax = isKeySync ? 10.0 : 200;
  
  // Adjust tooltip for AM vs FM
  let rateTooltip = "";
  let depthTooltip = "";
  
  if (isKeySync) {
      rateTooltip = `Ratio: ${settings.rate.toFixed(2)}x`;
      if (settings.target === 'amplitude') {
          if (settings.depth > 0.9) {
              depthTooltip = `Depth: ${(settings.depth * 100).toFixed(0)}% (Ring Mod)`;
          } else {
              depthTooltip = `Depth: ${(settings.depth * 100).toFixed(0)}% (AM)`;
          }
      } else if (settings.target === 'pitch') {
          depthTooltip = `Index: ${(settings.depth * 4.0).toFixed(1)}`;
          rateTooltip += ' (FM)';
      }
  } else {
      rateTooltip = `Rate: ${settings.rate.toFixed(1)} Hz`;
      depthTooltip = `Depth: ${(settings.depth * 100).toFixed(0)}%`;
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
            className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 overflow-visible pt-4 mt-4 border-t border-synth-gray-700/50' : 'max-h-0 opacity-0 overflow-hidden'}`}
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="flex flex-col gap-4">
                     <div className="flex items-center justify-between">
                        <label htmlFor="lfo-toggle" className="text-sm text-synth-gray-500 cursor-pointer">Enable LFO</label>
                        <label className="relative cursor-pointer">
                            <input 
                                type="checkbox" 
                                id="lfo-toggle"
                                className="sr-only" 
                                checked={settings.on} 
                                onChange={(e) => handleToggle('on')(e.target.checked)}
                            />
                            <div className={`block w-12 h-6 rounded-full transition-colors ${settings.on ? 'bg-synth-cyan-500' : 'bg-synth-gray-700'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.on ? 'transform translate-x-6' : ''}`}></div>
                        </label>
                    </div>
                     
                    <div className="flex gap-4">
                        <div className="flex flex-col gap-2 flex-1">
                            <div className="flex items-center justify-between">
                                <label htmlFor="lfo-retrigger-toggle" className="text-sm text-synth-gray-500 cursor-pointer">Retrigger</label>
                                <label className="relative cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        id="lfo-retrigger-toggle"
                                        className="sr-only" 
                                        checked={settings.retrigger} 
                                        onChange={(e) => handleToggle('retrigger')(e.target.checked)}
                                    />
                                    <div className={`block w-10 h-5 rounded-full transition-colors ${settings.retrigger ? 'bg-synth-purple-500' : 'bg-synth-gray-700'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${settings.retrigger ? 'transform translate-x-5' : ''}`}></div>
                                </label>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-2 flex-1">
                            <div className="flex items-center justify-between">
                                <label htmlFor="lfo-keysync-toggle" className="text-sm text-synth-gray-500 cursor-pointer">Key Sync (FM/AM)</label>
                                <label className="relative cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        id="lfo-keysync-toggle"
                                        className="sr-only" 
                                        checked={settings.keySync || false} 
                                        onChange={(e) => handleToggle('keySync')(e.target.checked)}
                                    />
                                    <div className={`block w-10 h-5 rounded-full transition-colors ${settings.keySync ? 'bg-synth-purple-500' : 'bg-synth-gray-700'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${settings.keySync ? 'transform translate-x-5' : ''}`}></div>
                                </label>
                            </div>
                        </div>
                    </div>

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
                        <SliderControl 
                            label={rateLabel} 
                            value={settings.rate} 
                            min={rateMin} 
                            max={rateMax} 
                            step={0.1} 
                            onChange={handleSliderChange('rate')} 
                            showTooltip={showTooltips} 
                            tooltipText={rateTooltip}
                        />
                        <SliderControl 
                            label="Depth" 
                            value={settings.depth} 
                            min={0} 
                            max={1} 
                            step={0.01} 
                            onChange={handleSliderChange('depth')} 
                            showTooltip={showTooltips} 
                            tooltipText={depthTooltip} 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
