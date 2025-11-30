
import React from 'react';
import type { ADSREnvelope } from '../types';
import { SliderControl } from './Knob';
import { EnvelopeVisualizer } from './EnvelopeVisualizer';

interface EnvelopeSectionProps {
    adsr: ADSREnvelope;
    setAdsr: React.Dispatch<React.SetStateAction<ADSREnvelope>>;
    showTooltips: boolean;
}

export const EnvelopeSection: React.FC<EnvelopeSectionProps> = ({ adsr, setAdsr, showTooltips }) => {
    const handleChange = (param: keyof ADSREnvelope) => (value: number) => {
        setAdsr(prev => ({ ...prev, [param]: value }));
    };

    return (
        <div className="bg-synth-gray-800 p-4 rounded-lg flex flex-col gap-4 h-full">
            <h3 className="text-lg font-semibold text-white">Envelope (ADSR)</h3>
            <div className="border border-synth-gray-700 rounded overflow-hidden">
                <EnvelopeVisualizer adsr={adsr} />
            </div>
            <div className="grid grid-cols-4 gap-2 flex-grow min-h-[140px]">
                <SliderControl label="Attack" value={adsr.attack} defaultValue={0.02} min={0.01} max={2} step={0.01} onChange={handleChange('attack')} showTooltip={showTooltips} tooltipText={`Attack: ${(adsr.attack * 1000).toFixed(0)} ms`} />
                <SliderControl label="Decay" value={adsr.decay} defaultValue={0.1} min={0.01} max={2} step={0.01} onChange={handleChange('decay')} showTooltip={showTooltips} tooltipText={`Decay: ${(adsr.decay * 1000).toFixed(0)} ms`} />
                <SliderControl label="Sustain" value={adsr.sustain} defaultValue={0.8} min={0} max={1} step={0.01} onChange={handleChange('sustain')} showTooltip={showTooltips} tooltipText={`Sustain: ${(adsr.sustain * 100).toFixed(0)}%`} />
                <SliderControl label="Release" value={adsr.release} defaultValue={0.4} min={0.01} max={4} step={0.01} onChange={handleChange('release')} showTooltip={showTooltips} tooltipText={`Release: ${(adsr.release * 1000).toFixed(0)} ms`} />
            </div>
        </div>
    );
};
