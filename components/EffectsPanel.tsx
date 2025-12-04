

import React, { useState } from 'react';
import type { ReverbSettings, DelaySettings, FilterSettings, FilterType, SaturationSettings, PhaserSettings, ChorusSettings } from '../types';
import { ChevronDownIcon } from './icons';
import { SliderControl, RotaryKnob } from './Knob';
import { Tooltip } from './Tooltip';

// --- Reusable Components ---

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <h4 className="text-sm font-bold text-white uppercase tracking-wider">
        {title}
    </h4>
);

const ToggleSwitch: React.FC<{
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}> = ({ id, checked, onChange }) => (
     <label htmlFor={id} className="relative cursor-pointer">
        <input 
            type="checkbox" 
            id={id}
            className="sr-only" 
            checked={checked} 
            onChange={(e) => onChange(e.target.checked)}
        />
        <div className={`block w-8 h-4 rounded-full transition-colors ${checked ? 'bg-[rgb(var(--accent-500))]' : 'bg-synth-gray-700'}`}></div>
        <div className={`absolute left-0.5 top-0.5 bg-white w-3 h-3 rounded-full transition-transform ${checked ? 'transform translate-x-4' : ''}`}></div>
    </label>
);

const RadioPill: React.FC<{
    options: { value: string; label: string }[];
    selectedValue: string;
    onChange: (value: string) => void;
    name: string;
}> = ({ options, selectedValue, onChange, name }) => (
    <div className="flex bg-synth-gray-700 rounded-md p-0.5">
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
                <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-sm cursor-pointer transition-colors block ${
                    selectedValue === value ? 'bg-[rgb(var(--secondary-500))] text-white' : 'text-synth-gray-500 hover:bg-synth-gray-600'
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
            <Tooltip text="Add post-processing effects like reverb, delay, and distortion to shape your sound." show={showTooltips}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex justify-between items-center w-full"
                    aria-expanded={isOpen}
                    aria-controls="effects-content"
                >
                    <h3 className="text-lg font-semibold text-white">Effects</h3>
                    <ChevronDownIcon className={`w-6 h-6 text-synth-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </Tooltip>

            <div
                id="effects-content"
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1200px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'}`}
            >
                <div className="pt-4 border-t border-synth-gray-700/50 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    
                    {/* --- FILTER --- */}
                    <div className={`bg-synth-gray-800 p-3 rounded-lg border-l-4 transition-all ${filter.on ? 'border-[rgb(var(--accent-500))]' : 'border-synth-gray-700 opacity-80'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <SectionHeader title="Filter" />
                             <ToggleSwitch id="filter-toggle" checked={filter.on} onChange={c => onFilterChange(p => ({...p, on: c}))} />
                        </div>
                        <div className={`${!filter.on ? 'pointer-events-none opacity-50' : ''} space-y-3`}>
                            <RadioPill name="filter-type" options={[{ value: 'lowpass', label: 'LP' }, { value: 'highpass', label: 'HP' }, { value: 'bandpass', label: 'BP' }]} selectedValue={filter.type} onChange={v => onFilterChange(p => ({ ...p, type: v as FilterType }))} />
                            <div className="flex justify-around pt-2">
                                <RotaryKnob label="Cutoff" value={filter.cutoff} defaultValue={2000} min={20} max={20000} step={1} onChange={c => onFilterChange(p => ({...p, cutoff: c}))} showTooltip={showTooltips} logarithmic />
                                <RotaryKnob label="Res" value={filter.resonance} defaultValue={1} min={0.01} max={24} step={0.1} onChange={handleFilterChange('resonance')} showTooltip={showTooltips} />
                            </div>
                        </div>
                    </div>
                    
                    {/* --- SATURATION --- */}
                    <div className={`bg-synth-gray-800 p-3 rounded-lg border-l-4 transition-all ${saturation.on ? 'border-[rgb(var(--accent-500))]' : 'border-synth-gray-700 opacity-80'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <SectionHeader title="Distortion" />
                             <ToggleSwitch id="saturation-toggle" checked={saturation.on} onChange={c => onSaturationChange(p => ({...p, on: c}))} />
                        </div>
                         <div className={`flex justify-around pt-4 ${!saturation.on ? 'pointer-events-none opacity-50' : ''}`}>
                            <SliderControl label="Mix" value={saturation.mix} defaultValue={0.5} min={0} max={1} step={0.01} onChange={handleSaturationChange('mix')} showTooltip={showTooltips} tooltipText={`Mix: ${(saturation.mix * 100).toFixed(0)}%`} />
                            <RotaryKnob label="Drive" value={saturation.drive} defaultValue={0.5} min={0.01} max={1} step={0.01} onChange={handleSaturationChange('drive')} showTooltip={showTooltips} tooltipText={`Drive: ${(saturation.drive * 100).toFixed(0)}%`} />
                        </div>
                    </div>

                    {/* --- PHASER --- */}
                    <div className={`bg-synth-gray-800 p-3 rounded-lg border-l-4 transition-all ${phaser.on ? 'border-[rgb(var(--accent-500))]' : 'border-synth-gray-700 opacity-80'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <SectionHeader title="Phaser" />
                             <ToggleSwitch id="phaser-toggle" checked={phaser.on} onChange={c => onPhaserChange(p => ({...p, on: c}))} />
                        </div>
                         <div className={`grid grid-cols-4 gap-1 pt-2 ${!phaser.on ? 'pointer-events-none opacity-50' : ''}`}>
                            <SliderControl label="Mix" value={phaser.mix} defaultValue={0.5} min={0} max={1} step={0.01} onChange={handlePhaserChange('mix')} showTooltip={showTooltips} tooltipText={`Mix: ${(phaser.mix * 100).toFixed(0)}%`} />
                            <RotaryKnob label="Rate" value={phaser.rate} defaultValue={1.2} min={0.1} max={8} step={0.1} onChange={handlePhaserChange('rate')} showTooltip={showTooltips} />
                            <RotaryKnob label="Depth" value={phaser.depth} defaultValue={0.8} min={0} max={1} step={0.01} onChange={handlePhaserChange('depth')} showTooltip={showTooltips} />
                            <RotaryKnob label="Freq" value={phaser.baseFrequency} defaultValue={350} min={20} max={2000} step={1} onChange={v => onPhaserChange(p => ({...p, baseFrequency: v}))} showTooltip={showTooltips} logarithmic />
                        </div>
                    </div>
                    
                    {/* --- CHORUS --- */}
                    <div className={`bg-synth-gray-800 p-3 rounded-lg border-l-4 transition-all ${chorus.on ? 'border-[rgb(var(--accent-500))]' : 'border-synth-gray-700 opacity-80'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <SectionHeader title="Chorus" />
                             <ToggleSwitch id="chorus-toggle" checked={chorus.on} onChange={c => onChorusChange(p => ({...p, on: c}))} />
                        </div>
                         <div className={`grid grid-cols-3 gap-2 pt-2 ${!chorus.on ? 'pointer-events-none opacity-50' : ''}`}>
                            <SliderControl label="Mix" value={chorus.mix} defaultValue={0.4} min={0} max={1} step={0.01} onChange={handleChorusChange('mix')} showTooltip={showTooltips} tooltipText={`Mix: ${(chorus.mix * 100).toFixed(0)}%`} />
                            <RotaryKnob label="Rate" value={chorus.rate} defaultValue={1.5} min={0.1} max={8} step={0.1} onChange={handleChorusChange('rate')} showTooltip={showTooltips} />
                            <RotaryKnob label="Depth" value={chorus.depth} defaultValue={0.7} min={0} max={1} step={0.01} onChange={handleChorusChange('depth')} showTooltip={showTooltips} />
                        </div>
                    </div>

                    {/* --- DELAY --- */}
                     <div className={`bg-synth-gray-800 p-3 rounded-lg border-l-4 transition-all ${delay.on ? 'border-[rgb(var(--accent-500))]' : 'border-synth-gray-700 opacity-80'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <SectionHeader title="Delay" />
                            <ToggleSwitch id="delay-toggle" checked={delay.on} onChange={c => onDelayChange(p => ({...p, on: c}))} />
                        </div>
                        <div className={`grid grid-cols-3 gap-2 pt-2 ${!delay.on ? 'pointer-events-none opacity-50' : ''}`}>
                            <SliderControl label="Mix" value={delay.mix} defaultValue={0.4} min={0} max={1} step={0.01} onChange={handleDelayChange('mix')} showTooltip={showTooltips} tooltipText={`Mix: ${(delay.mix * 100).toFixed(0)}%`} />
                            <RotaryKnob label="Time" value={delay.time} defaultValue={0.5} min={0.01} max={2} step={0.01} onChange={handleDelayChange('time')} showTooltip={showTooltips} />
                            <RotaryKnob label="Fdbk" value={delay.feedback} defaultValue={0.4} min={0} max={0.95} step={0.01} onChange={handleDelayChange('feedback')} showTooltip={showTooltips} />
                        </div>
                    </div>
                    
                    {/* --- REVERB --- */}
                     <div className={`bg-synth-gray-800 p-3 rounded-lg border-l-4 transition-all ${reverb.on ? 'border-[rgb(var(--accent-500))]' : 'border-synth-gray-700 opacity-80'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <SectionHeader title="Reverb" />
                             <ToggleSwitch id="reverb-toggle" checked={reverb.on} onChange={c => onReverbChange(p => ({...p, on: c}))} />
                        </div>
                         <div className={`flex justify-around pt-4 ${!reverb.on ? 'pointer-events-none opacity-50' : ''}`}>
                            <SliderControl label="Mix" value={reverb.mix} defaultValue={0.3} min={0} max={1} step={0.01} onChange={handleReverbChange('mix')} showTooltip={showTooltips} tooltipText={`Mix: ${(reverb.mix * 100).toFixed(0)}%`} />
                            <RotaryKnob label="Decay" value={reverb.decay} defaultValue={1.5} min={0.1} max={5} step={0.1} onChange={handleReverbChange('decay')} showTooltip={showTooltips} tooltipText={`Decay: ${reverb.decay.toFixed(1)} s`} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}