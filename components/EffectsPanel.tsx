
import React, { useState } from 'react';
import type { ReverbSettings, DelaySettings, FilterSettings, FilterType, SaturationSettings, PhaserSettings, ChorusSettings } from '../types';
import { ChevronDownIcon } from './icons';
import { SliderControl } from './Knob';
import { Tooltip } from './Tooltip';

// --- Reusable Components ---

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <h4 className="text-base font-semibold text-white">
        {title}
    </h4>
);

const ToggleSwitch: React.FC<{
    id: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}> = ({ id, label, checked, onChange }) => (
     <label htmlFor={id} className="flex items-center cursor-pointer">
        <span className="text-sm text-synth-gray-500 mr-3">{label}</span>
        <div className="relative">
            <input 
                type="checkbox" 
                id={id}
                className="sr-only" 
                checked={checked} 
                onChange={(e) => onChange(e.target.checked)}
            />
            <div className={`block w-12 h-6 rounded-full transition-colors ${checked ? 'bg-synth-cyan-500' : 'bg-synth-gray-700'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'transform translate-x-6' : ''}`}></div>
        </div>
    </label>
);

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


// --- Main Panel Props ---
interface EffectsPanelProps {
    reverb: ReverbSettings;
    onReverbChange: React.Dispatch<React.SetStateAction<ReverbSettings>>;
    delay: DelaySettings;
    onDelayChange: React.Dispatch<React.SetStateAction<DelaySettings>>;
    filter: FilterSettings;
    onFilterChange: React.Dispatch<React.SetStateAction<FilterSettings>>;
    saturation: SaturationSettings;
    onSaturationChange: React.Dispatch<React.SetStateAction<SaturationSettings>>;
    phaser: PhaserSettings;
    onPhaserChange: React.Dispatch<React.SetStateAction<PhaserSettings>>;
    chorus: ChorusSettings;
    onChorusChange: React.Dispatch<React.SetStateAction<ChorusSettings>>;
    showTooltips: boolean;
}

const LogSliderControl: React.FC<{
    label: string;
    value: number; // in Hz
    minHz: number;
    maxHz: number;
    onChange: (value: number) => void;
    showTooltip?: boolean;
    tooltipText?: string;
}> = ({ label, value, minHz, maxHz, onChange, showTooltip = false, tooltipText }) => {
    const minLog = Math.log(minHz);
    const maxLog = Math.log(maxHz);
    const getLogValue = (hz: number) => ((Math.log(hz) - minLog) / (maxLog - minLog)) * 100;
    const setLogValue = (pos: number) => Math.exp(minLog + (pos/100) * (maxLog - minLog));
    
    const displayValue = value > 1000 ? `${(value/1000).toFixed(1)}k` : value.toFixed(0);
    const defaultTooltipText = `${label}: ${displayValue} Hz`;

    return (
        <Tooltip show={showTooltip} text={tooltipText || defaultTooltipText}>
            <div className="flex flex-col items-center justify-end gap-2 h-full">
                <div className="relative flex-grow w-full flex items-center justify-center">
                    <input
                        type="range"
                        min={0}
                        max={100}
                        step={0.1}
                        value={getLogValue(value)}
                        onChange={(e) => onChange(setLogValue(parseFloat(e.target.value)))}
                        className="slider-rotated"
                        aria-label={label}
                    />
                </div>
                <div className="flex flex-col items-center">
                    <label className="text-xs font-medium text-synth-gray-500 whitespace-nowrap">{label}</label>
                    <span className="text-xs font-mono text-white bg-synth-gray-700 px-2 py-0.5 rounded">
                        {displayValue} Hz
                    </span>
                </div>
            </div>
        </Tooltip>
    );
};

export const EffectsPanel: React.FC<EffectsPanelProps> = ({
    reverb, onReverbChange,
    delay, onDelayChange,
    filter, onFilterChange,
    saturation, onSaturationChange,
    phaser, onPhaserChange,
    chorus, onChorusChange,
    showTooltips,
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleReverbChange = (param: keyof Omit<ReverbSettings, 'on'>) => (value: number) => onReverbChange(p => ({ ...p, [param]: value }));
    const handleDelayChange = (param: keyof Omit<DelaySettings, 'on'>) => (value: number) => onDelayChange(p => ({ ...p, [param]: value }));
    const handleFilterChange = (param: keyof Omit<FilterSettings, 'on' | 'type'>) => (value: number) => onFilterChange(p => ({ ...p, [param]: value }));
    const handleSaturationChange = (param: keyof Omit<SaturationSettings, 'on'>) => (value: number) => onSaturationChange(p => ({ ...p, [param]: value }));
    const handlePhaserChange = (param: keyof Omit<PhaserSettings, 'on' | 'baseFrequency'>) => (value: number) => onPhaserChange(p => ({ ...p, [param]: value }));
    const handleChorusChange = (param: keyof Omit<ChorusSettings, 'on'>) => (value: number) => onChorusChange(p => ({ ...p, [param]: value }));
    
    return (
        <div className="w-full bg-synth-gray-900 shadow-2xl rounded-xl p-4 flex flex-col gap-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex justify-between items-center w-full"
                aria-expanded={isOpen}
                aria-controls="effects-content"
            >
                <h3 className="text-lg font-semibold text-white">Effects</h3>
                <ChevronDownIcon className={`w-6 h-6 text-synth-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <div
                id="effects-content"
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
                <div className="pt-4 border-t border-synth-gray-700/50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    
                    {/* --- FILTER --- */}
                    <div className="bg-synth-gray-800 p-3 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                            <SectionHeader title="Filter" />
                             <ToggleSwitch id="filter-toggle" label="On" checked={filter.on} onChange={c => onFilterChange(p => ({...p, on: c}))} />
                        </div>
                        <div className={`transition-opacity duration-300 ${!filter.on ? 'opacity-40 pointer-events-none' : ''}`}>
                            <RadioPill name="filter-type" options={[{ value: 'lowpass', label: 'LP' }, { value: 'highpass', label: 'HP' }, { value: 'bandpass', label: 'BP' }]} selectedValue={filter.type} onChange={v => onFilterChange(p => ({ ...p, type: v as FilterType }))} />
                            <div className="grid grid-cols-2 gap-4 pt-4 h-36">
                                <LogSliderControl label="Cutoff" value={filter.cutoff} minHz={20} maxHz={20000} onChange={c => onFilterChange(p => ({...p, cutoff: c}))} showTooltip={showTooltips} />
                                <SliderControl label="Resonance" value={filter.resonance} min={0.01} max={24} step={0.1} onChange={handleFilterChange('resonance')} showTooltip={showTooltips} tooltipText={`Resonance: ${filter.resonance.toFixed(1)} Q`} />
                            </div>
                        </div>
                    </div>
                    
                    {/* --- SATURATION --- */}
                    <div className="bg-synth-gray-800 p-3 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                            <SectionHeader title="Saturation" />
                             <ToggleSwitch id="saturation-toggle" label="On" checked={saturation.on} onChange={c => onSaturationChange(p => ({...p, on: c}))} />
                        </div>
                         <div className={`transition-opacity duration-300 ${!saturation.on ? 'opacity-40 pointer-events-none' : ''}`}>
                             <div className="grid grid-cols-2 gap-4 pt-4 h-36">
                                <SliderControl label="Mix" value={saturation.mix} min={0} max={1} step={0.01} onChange={handleSaturationChange('mix')} showTooltip={showTooltips} tooltipText={`Mix: ${(saturation.mix * 100).toFixed(0)}%`} />
                                <SliderControl label="Drive" value={saturation.drive} min={0.01} max={1} step={0.01} onChange={handleSaturationChange('drive')} showTooltip={showTooltips} tooltipText={`Drive: ${(saturation.drive * 100).toFixed(0)}%`} />
                            </div>
                        </div>
                    </div>

                    {/* --- PHASER --- */}
                    <div className="bg-synth-gray-800 p-3 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                            <SectionHeader title="Phaser" />
                             <ToggleSwitch id="phaser-toggle" label="On" checked={phaser.on} onChange={c => onPhaserChange(p => ({...p, on: c}))} />
                        </div>
                         <div className={`transition-opacity duration-300 ${!phaser.on ? 'opacity-40 pointer-events-none' : ''}`}>
                             <div className="grid grid-cols-4 gap-2 pt-1 h-36">
                                <SliderControl label="Mix" value={phaser.mix} min={0} max={1} step={0.01} onChange={handlePhaserChange('mix')} showTooltip={showTooltips} tooltipText={`Mix: ${(phaser.mix * 100).toFixed(0)}%`} />
                                <SliderControl label="Rate" value={phaser.rate} min={0.1} max={8} step={0.1} onChange={handlePhaserChange('rate')} showTooltip={showTooltips} tooltipText={`Rate: ${phaser.rate.toFixed(1)} Hz`} />
                                <SliderControl label="Depth" value={phaser.depth} min={0} max={1} step={0.01} onChange={handlePhaserChange('depth')} showTooltip={showTooltips} tooltipText={`Depth: ${(phaser.depth * 100).toFixed(0)}%`} />
                                <LogSliderControl label="Freq" value={phaser.baseFrequency} minHz={20} maxHz={2000} onChange={v => onPhaserChange(p => ({...p, baseFrequency: v}))} showTooltip={showTooltips} />
                            </div>
                        </div>
                    </div>
                    
                    {/* --- CHORUS --- */}
                    <div className="bg-synth-gray-800 p-3 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                            <SectionHeader title="Chorus" />
                             <ToggleSwitch id="chorus-toggle" label="On" checked={chorus.on} onChange={c => onChorusChange(p => ({...p, on: c}))} />
                        </div>
                         <div className={`transition-opacity duration-300 ${!chorus.on ? 'opacity-40 pointer-events-none' : ''}`}>
                             <div className="grid grid-cols-3 gap-2 pt-1 h-36">
                                <SliderControl label="Mix" value={chorus.mix} min={0} max={1} step={0.01} onChange={handleChorusChange('mix')} showTooltip={showTooltips} tooltipText={`Mix: ${(chorus.mix * 100).toFixed(0)}%`} />
                                <SliderControl label="Rate" value={chorus.rate} min={0.1} max={8} step={0.1} onChange={handleChorusChange('rate')} showTooltip={showTooltips} tooltipText={`Rate: ${chorus.rate.toFixed(1)} Hz`} />
                                <SliderControl label="Depth" value={chorus.depth} min={0} max={1} step={0.01} onChange={handleChorusChange('depth')} showTooltip={showTooltips} tooltipText={`Depth: ${(chorus.depth * 100).toFixed(0)}%`} />
                            </div>
                        </div>
                    </div>

                    {/* --- DELAY --- */}
                     <div className="bg-synth-gray-800 p-3 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                            <SectionHeader title="Delay" />
                            <ToggleSwitch id="delay-toggle" label="On" checked={delay.on} onChange={c => onDelayChange(p => ({...p, on: c}))} />
                        </div>
                        <div className={`transition-opacity duration-300 ${!delay.on ? 'opacity-40 pointer-events-none' : ''}`}>
                             <div className="grid grid-cols-3 gap-2 pt-1 h-36">
                                <SliderControl label="Mix" value={delay.mix} min={0} max={1} step={0.01} onChange={handleDelayChange('mix')} showTooltip={showTooltips} tooltipText={`Mix: ${(delay.mix * 100).toFixed(0)}%`} />
                                <SliderControl label="Time" value={delay.time} min={0.01} max={2} step={0.01} onChange={handleDelayChange('time')} showTooltip={showTooltips} tooltipText={`Time: ${(delay.time * 1000).toFixed(0)} ms`} />
                                <SliderControl label="Feedback" value={delay.feedback} min={0} max={0.95} step={0.01} onChange={handleDelayChange('feedback')} showTooltip={showTooltips} tooltipText={`Feedback: ${(delay.feedback * 100).toFixed(0)}%`} />
                            </div>
                        </div>
                    </div>
                    
                    {/* --- REVERB --- */}
                     <div className="bg-synth-gray-800 p-3 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                            <SectionHeader title="Reverb" />
                             <ToggleSwitch id="reverb-toggle" label="On" checked={reverb.on} onChange={c => onReverbChange(p => ({...p, on: c}))} />
                        </div>
                         <div className={`transition-opacity duration-300 ${!reverb.on ? 'opacity-40 pointer-events-none' : ''}`}>
                             <div className="grid grid-cols-2 gap-4 pt-4 h-36">
                                <SliderControl label="Mix" value={reverb.mix} min={0} max={1} step={0.01} onChange={handleReverbChange('mix')} showTooltip={showTooltips} tooltipText={`Mix: ${(reverb.mix * 100).toFixed(0)}%`} />
                                <SliderControl label="Decay" value={reverb.decay} min={0.1} max={5} step={0.1} onChange={handleReverbChange('decay')} showTooltip={showTooltips} tooltipText={`Decay: ${reverb.decay.toFixed(1)} s`} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}