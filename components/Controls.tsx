
import React from 'react';
import type { ADSREnvelope, OscillatorSettings, SynthPreset, PresetCategory } from '../types';
import { Lissajous } from './Lissajous';
import { SpectrumAnalyzer } from './SpectrumAnalyzer';
import { SliderControl } from './Knob';
import { SYNTH_PRESETS } from '../constants';
import { OscillatorSection } from './OscillatorSection';
import { EnvelopeSection } from './EnvelopeSection';
import { SampleSection } from './SampleSection';

// --- PROPS INTERFACE ---
interface ControlsProps {
  adsr: ADSREnvelope;
  setAdsr: React.Dispatch<React.SetStateAction<ADSREnvelope>>;
  osc1: OscillatorSettings;
  setOsc1: React.Dispatch<React.SetStateAction<OscillatorSettings>>;
  osc2: OscillatorSettings;
  setOsc2: React.Dispatch<React.SetStateAction<OscillatorSettings>>;
  oscMix: number;
  setOscMix: React.Dispatch<React.SetStateAction<number>>;
  onPresetChange: (preset: SynthPreset) => void;
  activePresetName: string;
  activeCategory: PresetCategory;
  analyserX: AnalyserNode | null;
  analyserY: AnalyserNode | null;
  showTooltips: boolean;
  onSampleLoad?: (buffer: ArrayBuffer) => void;
  sampleBuffer?: AudioBuffer | null;
  trimStart: number;
  trimEnd: number;
  onTrimChange: (start: number, end: number) => void;
  sampleVolume?: number;
  onSampleVolumeChange?: (volume: number) => void;
  sampleLoop?: boolean;
  onSampleLoopChange?: (loop: boolean) => void;
  sampleBpm?: number;
  onSampleBpmChange?: (bpm: number) => void;
}

export const Controls: React.FC<ControlsProps> = ({
  adsr, setAdsr,
  osc1, setOsc1,
  osc2, setOsc2,
  oscMix, setOscMix,
  onPresetChange, activePresetName, activeCategory,
  analyserX, analyserY,
  showTooltips,
  onSampleLoad,
  sampleBuffer,
  trimStart, trimEnd, onTrimChange,
  sampleVolume, onSampleVolumeChange,
  sampleLoop, onSampleLoopChange,
  sampleBpm, onSampleBpmChange
}) => {
  const isSingleOscillatorMode = SYNTH_PRESETS.find(p => p.name === activePresetName)?.singleOscillator ?? false;
  const isSamplingMode = activeCategory === 'Sampling';

  // Categorize presets
  const categories: PresetCategory[] = ['Simple', 'Subtractive', 'AM', 'FM', 'Sampling'];
  const presetsByCategory = React.useMemo(() => {
      const grouped: Record<PresetCategory, SynthPreset[]> = {
          'Simple': [], 'Subtractive': [], 'AM': [], 'Sampling': [], 'FM': []
      };
      SYNTH_PRESETS.forEach(p => grouped[p.category].push(p));
      return grouped;
  }, []);

  const handleTabClick = (category: PresetCategory) => {
      const firstPreset = presetsByCategory[category][0];
      if (firstPreset) {
          onPresetChange(firstPreset);
      }
  };

  const isFm = activeCategory === 'FM';

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* --- PRESETS PANEL --- */}
      <div className="bg-synth-gray-800 p-4 rounded-lg space-y-4 shadow-lg border-t-2 border-[rgb(var(--accent-500))]">
        <div className="flex flex-wrap gap-2 border-b border-synth-gray-700 pb-2 mb-2">
            {categories.map(category => (
                <button
                    key={category}
                    onClick={() => handleTabClick(category)}
                    className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-all border-b-2 ${
                        activeCategory === category 
                        ? 'bg-[rgb(var(--accent-500))] text-synth-gray-900 border-[rgb(var(--secondary-500))] shadow-[0_0_15px_rgba(var(--accent-500),0.3)]' 
                        : 'text-synth-gray-500 hover:text-white border-transparent hover:bg-synth-gray-700'
                    }`}
                >
                    {category}
                </button>
            ))}
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
            {presetsByCategory[activeCategory].map(preset => (
                <button 
                    key={preset.name} 
                    onClick={() => onPresetChange(preset)}
                    className={`p-2 rounded-md cursor-pointer transition-all text-center text-xs font-bold ${
                        preset.name === activePresetName 
                        ? 'bg-[rgb(var(--secondary-500))] text-white shadow-md ring-1 ring-white/20' 
                        : 'bg-synth-gray-700 hover:bg-synth-gray-600 text-gray-300'
                    }`}
                >
                    {preset.name}
                </button>
            ))}
        </div>
      </div>

      {/* --- ROW 1: SOUND SOURCE & ENVELOPE --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        
        {/* LEFT: Source / Sampler (Takes 2/3 of width) */}
        <div className="lg:col-span-2 flex flex-col h-full">
            {isSamplingMode ? (
                <SampleSection 
                    onSampleLoad={onSampleLoad}
                    sampleBuffer={sampleBuffer}
                    trimStart={trimStart}
                    trimEnd={trimEnd}
                    onTrimChange={onTrimChange}
                    sampleVolume={sampleVolume}
                    onSampleVolumeChange={onSampleVolumeChange}
                    sampleLoop={sampleLoop}
                    onSampleLoopChange={onSampleLoopChange}
                    sampleBpm={sampleBpm}
                    onSampleBpmChange={onSampleBpmChange}
                    showTooltips={showTooltips}
                />
            ) : (
                <div className="bg-synth-gray-800 p-4 rounded-lg h-full flex flex-col">
                    <h3 className="text-lg font-semibold text-white mb-4">Sound Source</h3>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch flex-grow">
                        <OscillatorSection id={1} settings={osc1} onSettingsChange={setOsc1} isSingleOscillatorMode={isSingleOscillatorMode} showTooltips={showTooltips} />
                        
                        {!isSingleOscillatorMode && (
                            <>
                                <div className="flex flex-col items-center justify-center p-2 bg-synth-gray-900/30 rounded-lg border border-synth-gray-700/30 w-full md:w-24">
                                    <SliderControl label="Mix" value={oscMix} min={0} max={1} step={0.01} onChange={setOscMix} showTooltip={showTooltips} tooltipText={`OSC 1: ${(100 - oscMix * 100).toFixed(0)}% | OSC 2: ${(oscMix * 100).toFixed(0)}%`} />
                                </div>
                                <OscillatorSection id={2} settings={osc2} onSettingsChange={setOsc2} isSingleOscillatorMode={isSingleOscillatorMode} showTooltips={showTooltips} />
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* RIGHT: Envelope (Takes 1/3 of width) */}
        <div className="lg:col-span-1 h-full">
            <EnvelopeSection adsr={adsr} setAdsr={setAdsr} showTooltips={showTooltips} />
        </div>
      </div>

      {/* --- ROW 2: VISUALIZERS --- */}
      <div className="flex flex-col md:flex-row gap-4 w-full h-[280px]">
            {/* Left: Spectrum Analyzer */}
            <div className="bg-synth-gray-800 p-4 rounded-lg flex flex-col flex-1 w-full md:w-1/2">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-bold text-synth-gray-500 uppercase tracking-wider">Spectrum</h3>
                </div>
                <div className="flex-grow bg-black rounded border border-synth-gray-700 overflow-hidden relative shadow-inner">
                     <div className="absolute inset-0">
                        <SpectrumAnalyzer analyser={analyserX} />
                    </div>
                </div>
            </div>

            {/* Right: X/Y Scope (Phase) */}
            <div className="bg-synth-gray-800 p-4 rounded-lg flex flex-col flex-1 w-full md:w-1/2">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-bold text-synth-gray-500 uppercase tracking-wider">X/Y Phase</h3>
                </div>
                <div className="flex-grow bg-black rounded border border-synth-gray-700 overflow-hidden relative shadow-inner">
                    <div className="absolute inset-0">
                        <Lissajous 
                            analyserX={analyserX} 
                            analyserY={analyserY}
                            colorX={isFm ? "rgb(var(--secondary-500))" : undefined}
                            colorY={isFm ? "rgb(var(--accent-500))" : undefined}
                        />
                    </div>
                </div>
            </div>
      </div>
    </div>
  );
};
