
import React from 'react';
import type { OscillatorSettings, WaveformType } from '../types';
import { WaveformIcon } from './icons';
import { Tooltip } from './Tooltip';
import { RotaryKnob } from './Knob';

interface OscillatorSectionProps {
    id: number;
    settings: OscillatorSettings;
    onSettingsChange: React.Dispatch<React.SetStateAction<OscillatorSettings>>;
    isSingleOscillatorMode: boolean;
    showTooltips: boolean;
}

export const OscillatorSection: React.FC<OscillatorSectionProps> = ({ id, settings, onSettingsChange, isSingleOscillatorMode, showTooltips }) => {
    const waveforms: WaveformType[] = ['sine', 'square', 'sawtooth', 'triangle'];

    const getWaveformLabel = (wave: WaveformType) => {
        if (!isSingleOscillatorMode) {
            if (wave === 'sawtooth') return 'saw';
            if (wave === 'triangle') return 'tri';
        }
        return wave;
    };

    const handleWaveformChange = (wave: WaveformType) => {
        onSettingsChange(prev => ({...prev, waveform: wave}));
    }
    const handleDetuneChange = (detune: number) => {
        onSettingsChange(prev => ({...prev, detune}));
    }
    const handleOctaveChange = (change: number) => {
        onSettingsChange(prev => ({ ...prev, octave: Math.max(-2, Math.min(2, prev.octave + change)) }));
    }

    return (
        <div 
            className="flex flex-col h-full bg-synth-gray-900/50 p-4 rounded-lg transition-colors"
        >
            <h3 
                className="text-sm font-bold text-white mb-3 tracking-widest uppercase border-b border-synth-gray-700/50 pb-1 flex justify-between items-center"
            >
                <span>Oscillator {id}</span>
                <span className="text-[10px] font-mono" style={{ color: 'rgb(var(--secondary-500))' }}>
                    {settings.octave > 0 ? '+' : ''}{settings.octave} OCT
                </span>
            </h3>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
                {waveforms.map(wave => (
                <label key={wave} className={`
                    p-2 rounded-md cursor-pointer transition-all flex items-center justify-center gap-1 relative group border
                    ${settings.waveform === wave 
                        ? 'bg-[rgb(var(--secondary-500))] text-white border-transparent shadow-sm' 
                        : 'bg-synth-gray-800 text-synth-gray-500 border-transparent hover:bg-synth-gray-700 hover:border-synth-gray-600'
                    }
                `}>
                    <Tooltip text={`Set Waveform: ${wave}`} show={showTooltips}>
                        <input type="radio" name={`waveform-${id}`} value={wave} checked={settings.waveform === wave} onChange={() => handleWaveformChange(wave)} className="sr-only" />
                        <WaveformIcon type={wave} className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase">{getWaveformLabel(wave)}</span>
                    </Tooltip>
                </label>
                ))}
            </div>
            
            <div className="flex justify-between items-end mt-auto">
                {/* Octave Control */}
                <div className="flex flex-col items-center gap-1">
                     <div className="flex items-center gap-1 bg-synth-gray-800 rounded-full p-1 border border-synth-gray-700">
                        <Tooltip text="Osc Octave Down" show={showTooltips}>
                            <button onClick={() => handleOctaveChange(-1)} disabled={settings.octave <= -2} className="w-6 h-6 rounded-full bg-synth-gray-700 text-white font-bold hover:bg-[rgb(var(--accent-500))] hover:text-black transition-colors disabled:opacity-30">-</button>
                        </Tooltip>
                        <Tooltip text="Osc Octave Up" show={showTooltips}>
                            <button onClick={() => handleOctaveChange(1)} disabled={settings.octave >= 2} className="w-6 h-6 rounded-full bg-synth-gray-700 text-white font-bold hover:bg-[rgb(var(--accent-500))] hover:text-black transition-colors disabled:opacity-30">+</button>
                        </Tooltip>
                    </div>
                    <span className="text-[9px] font-bold text-synth-gray-500 uppercase">Octave</span>
                </div>

                {/* Rotary Detune */}
                <RotaryKnob 
                    label="Detune" 
                    value={settings.detune} 
                    defaultValue={0}
                    min={-25} 
                    max={25} 
                    step={0.5} 
                    onChange={handleDetuneChange} 
                    showTooltip={showTooltips}
                    tooltipText={`${settings.detune > 0 ? '+' : ''}${settings.detune.toFixed(1)} cents`}
                />
            </div>
        </div>
    );
};
