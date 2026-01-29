
import React, { useState } from 'react';
import { ChevronDownIcon } from './icons';
import { Tooltip } from './Tooltip';
import type { VisualizerSettings } from '../types';

interface SettingsPanelProps {
    adaptiveTuning: boolean;
    onAdaptiveTuningChange: (enabled: boolean) => void;
    keyboardDisplayMode: 'noteNames' | 'notation' | 'solfege' | 'hz';
    onKeyboardDisplayModeChange: (mode: 'noteNames' | 'notation' | 'solfege' | 'hz') => void;
    solfegeKey: string;
    onSolfegeKeyChange: (key: string) => void;
    preferFlats: boolean;
    onPreferFlatsChange: (enabled: boolean) => void;
    displayKeys: string[];
    midiDeviceName: string | null;
    onConnectMidi: () => void;
    showTooltips: boolean;
    onShowTooltipsChange: (enabled: boolean) => void;
    visualizerSettings?: VisualizerSettings;
    onVisualizerSettingsChange?: (settings: VisualizerSettings) => void;
}

const SettingRow: React.FC<{ label: string; htmlFor?: string; children: React.ReactNode }> = ({ label, htmlFor, children }) => (
    <div className="flex items-center justify-between py-1">
        <label htmlFor={htmlFor} className="text-sm text-synth-gray-500 hover:text-white transition-colors cursor-pointer select-none">
            {label}
        </label>
        {children}
    </div>
);

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <h4 className="text-xs font-bold text-synth-gray-600 tracking-wider border-b border-synth-gray-700/50 pb-1 mb-2 mt-4 first:mt-2">
        {title}
    </h4>
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
                    selectedValue === value ? 'bg-synth-cyan-500 text-synth-gray-900 font-bold' : 'text-synth-gray-500 hover:bg-synth-gray-600'
                }`}>
                    {label}
                </span>
            </label>
        ))}
    </div>
);


export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    adaptiveTuning, onAdaptiveTuningChange,
    keyboardDisplayMode, onKeyboardDisplayModeChange,
    solfegeKey, onSolfegeKeyChange,
    preferFlats, onPreferFlatsChange,
    displayKeys,
    midiDeviceName, onConnectMidi,
    showTooltips, onShowTooltipsChange,
    visualizerSettings, onVisualizerSettingsChange
}) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const getMidiStatusClasses = () => {
        if (midiDeviceName === 'Access Denied') {
            return 'bg-red-500 text-white';
        }
        if (midiDeviceName === 'No Devices Found' || midiDeviceName === 'Not Supported' || midiDeviceName === 'Connecting...') {
            return 'bg-synth-gray-700 text-white';
        }
        // Any other non-null string is assumed to be a connected device name
        return 'bg-green-500 text-synth-gray-900';
    };

    return (
        <div className="w-full bg-synth-gray-900 shadow-2xl rounded-xl p-4 flex flex-col gap-4">
            <Tooltip text="Configure MIDI devices, keyboard display options, and audio engine settings." show={showTooltips}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex justify-between items-center w-full"
                    aria-expanded={isOpen}
                    aria-controls="settings-content"
                >
                    <h3 className="text-lg font-semibold text-white">Settings</h3>
                    <ChevronDownIcon className={`w-6 h-6 text-synth-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </Tooltip>

            <div
                id="settings-content"
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'}`}
            >
                <div className="pt-2 border-t border-synth-gray-700/50 flex flex-col">
                    <SectionHeader title="MIDI" />
                    <SettingRow label="MIDI Input">
                        {midiDeviceName === null ? (
                            <button
                                onClick={onConnectMidi}
                                className="px-3 py-1 text-xs rounded-md bg-synth-gray-700 hover:bg-synth-gray-600 text-white transition-colors"
                            >
                                Connect
                            </button>
                        ) : (
                             <span className={`text-xs font-mono px-2 py-1 rounded truncate max-w-[150px] ${getMidiStatusClasses()}`}>
                                {midiDeviceName}
                            </span>
                        )}
                    </SettingRow>

                    <SectionHeader title="Display & Interface" />
                     <SettingRow label="Keyboard Mode">
                        <RadioPill
                            name="display-mode"
                            options={[
                                { value: 'noteNames', label: 'Names' },
                                { value: 'notation', label: 'Notation' },
                                { value: 'solfege', label: 'Solfège' },
                                { value: 'hz', label: 'Hz' },
                            ]}
                            selectedValue={keyboardDisplayMode}
                            onChange={(val) => onKeyboardDisplayModeChange(val as any)}
                        />
                    </SettingRow>
                     <SettingRow label="Prefer Flats (♭)" htmlFor="prefer-flats-toggle">
                        <input
                            id="prefer-flats-toggle"
                            type="checkbox"
                            checked={preferFlats}
                            onChange={(e) => onPreferFlatsChange(e.target.checked)}
                            className="w-5 h-5 rounded bg-synth-gray-700 border-synth-gray-600 text-synth-cyan-500 focus:ring-2 focus:ring-offset-2 focus:ring-offset-synth-gray-900 focus:ring-synth-cyan-500 cursor-pointer"
                        />
                    </SettingRow>
                    {keyboardDisplayMode === 'solfege' && (
                        <SettingRow label="Solfège Key (Do)" htmlFor="solfege-key-select">
                            <select
                                id="solfege-key-select"
                                value={solfegeKey}
                                onChange={(e) => onSolfegeKeyChange(e.target.value)}
                                className="bg-synth-gray-700 text-white rounded-md p-1 text-sm focus:ring-2 focus:ring-synth-cyan-500 outline-none"
                            >
                                {displayKeys.map(key => <option key={key} value={key}>{key}</option>)}
                            </select>
                        </SettingRow>
                    )}
                    <SettingRow label="Show Tooltips" htmlFor="tooltips-toggle">
                        <input
                            id="tooltips-toggle"
                            type="checkbox"
                            checked={showTooltips}
                            onChange={(e) => onShowTooltipsChange(e.target.checked)}
                            className="w-5 h-5 rounded bg-synth-gray-700 border-synth-gray-600 text-synth-cyan-500 focus:ring-2 focus:ring-offset-2 focus:ring-offset-synth-gray-900 focus:ring-synth-cyan-500 cursor-pointer"
                        />
                    </SettingRow>

                    <SectionHeader title="Audio Engine" />
                    <SettingRow label="Adaptive Tuning" htmlFor="adaptive-tuning-toggle">
                        <input
                            id="adaptive-tuning-toggle"
                            type="checkbox"
                            checked={adaptiveTuning}
                            onChange={(e) => onAdaptiveTuningChange(e.target.checked)}
                            className="w-5 h-5 rounded bg-synth-gray-700 border-synth-gray-600 text-synth-cyan-500 focus:ring-2 focus:ring-offset-2 focus:ring-offset-synth-gray-900 focus:ring-synth-cyan-500 cursor-pointer"
                        />
                    </SettingRow>

                    {visualizerSettings && onVisualizerSettingsChange && (
                        <>
                            <SectionHeader title="Visualizer" />
                            <SettingRow label="Trail Length">
                                <input 
                                    type="range" 
                                    min="0.05" 
                                    max="0.5" 
                                    step="0.01" 
                                    // Invert value for "Trail Length" (Low Fade = Long Trail)
                                    value={0.55 - visualizerSettings.fade} 
                                    onChange={(e) => onVisualizerSettingsChange({...visualizerSettings, fade: 0.55 - parseFloat(e.target.value)})}
                                    className="w-24 horizontal-slider"
                                />
                            </SettingRow>
                            <SettingRow label="Line Width">
                                <input 
                                    type="range" 
                                    min="0.5" 
                                    max="5" 
                                    step="0.5" 
                                    value={visualizerSettings.lineWidth} 
                                    onChange={(e) => onVisualizerSettingsChange({...visualizerSettings, lineWidth: parseFloat(e.target.value)})}
                                    className="w-24 horizontal-slider"
                                />
                            </SettingRow>
                            <SettingRow label="Glow Amount">
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="50" 
                                    step="1" 
                                    value={visualizerSettings.glow} 
                                    onChange={(e) => onVisualizerSettingsChange({...visualizerSettings, glow: parseFloat(e.target.value)})}
                                    className="w-24 horizontal-slider"
                                />
                            </SettingRow>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
