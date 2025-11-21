
import React, { useState } from 'react';
import type { ArpeggiatorSettings, ArpDirection, ArpRate } from '../types';
import { ChevronDownIcon } from './icons';
import { Tooltip } from './Tooltip';
import { SliderControl } from './Knob';

interface ArpeggiatorPanelProps {
    settings: ArpeggiatorSettings;
    onSettingsChange: React.Dispatch<React.SetStateAction<ArpeggiatorSettings>>;
    showTooltips: boolean;
}

const RadioPill: React.FC<{
    options: { value: string; label: string }[];
    selectedValue: string;
    onChange: (value: string) => void;
    name: string;
    showTooltip: boolean;
    tooltipPrefix: string;
}> = ({ options, selectedValue, onChange, name, showTooltip, tooltipPrefix }) => (
    <div className="flex bg-synth-gray-700 rounded-full p-1">
        {options.map(({ value, label }) => (
            <label key={value} className="flex-1 text-center relative group">
                <Tooltip text={`${tooltipPrefix}: ${label}`} show={showTooltip}>
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
                </Tooltip>
            </label>
        ))}
    </div>
);

export const ArpeggiatorPanel: React.FC<ArpeggiatorPanelProps> = ({ settings, onSettingsChange, showTooltips }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleChange = (key: keyof ArpeggiatorSettings, value: any) => {
        onSettingsChange(prev => ({ ...prev, [key]: value }));
    };

    const directions: { value: ArpDirection; label: string }[] = [
        { value: 'up', label: 'Up' },
        { value: 'down', label: 'Dn' },
        { value: 'upDown', label: 'UpDn' },
        { value: 'random', label: 'Rnd' },
        { value: 'played', label: 'Play' }
    ];

    const rates: { value: ArpRate; label: string }[] = [
        { value: '1/4', label: '1/4' },
        { value: '1/8', label: '1/8' },
        { value: '1/16', label: '1/16' },
        { value: '1/32', label: '1/32' }
    ];

    return (
        <div className="bg-synth-gray-800 p-4 rounded-lg">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex justify-between items-center w-full"
                aria-expanded={isOpen}
                aria-controls="arp-content"
            >
                <h3 className="text-lg font-semibold text-white">Arpeggiator</h3>
                <ChevronDownIcon className={`w-6 h-6 text-synth-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div
                id="arp-content"
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 overflow-visible pt-4 mt-4 border-t border-synth-gray-700/50' : 'max-h-0 opacity-0 overflow-hidden'}`}
            >
                <div className="space-y-4">
                    {/* Enable Toggle */}
                    <div className="flex justify-between items-center">
                        <label htmlFor="arp-toggle" className="text-sm text-synth-gray-500 cursor-pointer">Enable Arpeggiator</label>
                        <Tooltip text={settings.on ? "Arpeggiator On" : "Arpeggiator Off"} show={showTooltips}>
                             <label className="relative cursor-pointer">
                                <input
                                    type="checkbox"
                                    id="arp-toggle"
                                    className="sr-only"
                                    checked={settings.on}
                                    onChange={(e) => handleChange('on', e.target.checked)}
                                />
                                <div className={`block w-12 h-6 rounded-full transition-colors ${settings.on ? 'bg-synth-cyan-500' : 'bg-synth-gray-700'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.on ? 'transform translate-x-6' : ''}`}></div>
                            </label>
                        </Tooltip>
                    </div>

                    <div className={`space-y-4 transition-opacity duration-300 ${!settings.on ? 'opacity-40 pointer-events-none' : ''}`}>
                         {/* Latch Toggle */}
                        <div className="flex justify-between items-center">
                            <label htmlFor="arp-latch-toggle" className="text-sm text-synth-gray-500 cursor-pointer">Latch Mode</label>
                             <Tooltip text="Sustain arpeggio after releasing keys" show={showTooltips}>
                                <label className="relative cursor-pointer">
                                    <input
                                        type="checkbox"
                                        id="arp-latch-toggle"
                                        className="sr-only"
                                        checked={settings.latch}
                                        onChange={(e) => handleChange('latch', e.target.checked)}
                                    />
                                    <div className={`block w-10 h-5 rounded-full transition-colors ${settings.latch ? 'bg-synth-purple-500' : 'bg-synth-gray-700'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${settings.latch ? 'transform translate-x-5' : ''}`}></div>
                                </label>
                            </Tooltip>
                        </div>

                        <div>
                            <span className="text-xs font-medium text-synth-gray-500 block mb-2">Rate</span>
                            <RadioPill name="arp-rate" options={rates} selectedValue={settings.rate} onChange={(v) => handleChange('rate', v)} showTooltip={showTooltips} tooltipPrefix="Rate" />
                        </div>

                        <div>
                            <span className="text-xs font-medium text-synth-gray-500 block mb-2">Direction</span>
                            <RadioPill name="arp-direction" options={directions} selectedValue={settings.direction} onChange={(v) => handleChange('direction', v)} showTooltip={showTooltips} tooltipPrefix="Direction" />
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                    <label className="text-xs font-medium text-synth-gray-500">Octaves</label>
                                    <span className="text-xs font-mono text-white">{settings.range}</span>
                                </div>
                                <Tooltip text={`Octave Range: ${settings.range}`} show={showTooltips}>
                                    <input
                                        type="range"
                                        min={1}
                                        max={3}
                                        step={1}
                                        value={settings.range}
                                        onChange={(e) => handleChange('range', parseInt(e.target.value))}
                                        className="horizontal-slider w-full"
                                    />
                                </Tooltip>
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                    <label className="text-xs font-medium text-synth-gray-500">Gate</label>
                                    <span className="text-xs font-mono text-white">{(settings.gate * 100).toFixed(0)}%</span>
                                </div>
                                <Tooltip text={`Note Length: ${(settings.gate * 100).toFixed(0)}%`} show={showTooltips}>
                                    <input
                                        type="range"
                                        min={0.1}
                                        max={1.0}
                                        step={0.1}
                                        value={settings.gate}
                                        onChange={(e) => handleChange('gate', parseFloat(e.target.value))}
                                        className="horizontal-slider w-full"
                                    />
                                </Tooltip>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
