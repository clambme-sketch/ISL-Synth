
import React, { useState, useRef, useEffect } from 'react';
import type { ADSREnvelope, WaveformType, OscillatorSettings, SynthPreset, PresetCategory } from '../types';
import { WaveformIcon, UploadIcon, MicrophoneIcon } from './icons';
import { Lissajous } from './Lissajous';
import { SliderControl } from './Knob';
import { EnvelopeVisualizer } from './EnvelopeVisualizer';
import { SYNTH_PRESETS } from '../constants';
import { Tooltip } from './Tooltip';
import { SampleEditor } from './SampleEditor';

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
}

// --- REUSABLE SUB-COMPONENTS ---

const OscillatorPanel: React.FC<{
    id: number;
    settings: OscillatorSettings;
    onSettingsChange: React.Dispatch<React.SetStateAction<OscillatorSettings>>;
    isSingleOscillatorMode: boolean;
}> = ({ id, settings, onSettingsChange, isSingleOscillatorMode }) => {
    const waveforms: WaveformType[] = ['sine', 'square', 'sawtooth', 'triangle'];

    const getWaveformLabel = (wave: WaveformType) => {
        if (!isSingleOscillatorMode) { // In 2-oscillator mode, space is tight
            if (wave === 'sawtooth') return 'saw';
            if (wave === 'triangle') return 'tri';
        }
        return wave; // Full name for single-oscillator mode or other waves
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
        <div className="space-y-4 flex flex-col h-full">
            <h3 className="text-lg font-semibold text-white">Oscillator {id}</h3>
            <div className="grid grid-cols-2 gap-2">
                {waveforms.map(wave => (
                <label key={wave} className={`p-2 rounded-md cursor-pointer transition-colors flex items-center justify-center gap-2 ${settings.waveform === wave ? 'bg-synth-purple-500 text-white' : 'bg-synth-gray-700 hover:bg-synth-gray-600'}`}>
                    <input type="radio" name={`waveform-${id}`} value={wave} checked={settings.waveform === wave} onChange={() => handleWaveformChange(wave)} className="sr-only" />
                    <WaveformIcon type={wave} className="w-6 h-4" />
                    <span>{getWaveformLabel(wave)}</span>
                </label>
                ))}
            </div>
            <div className="flex flex-col justify-between flex-grow pt-2 space-y-4">
                {/* Horizontal Detune Slider */}
                <div className="space-y-1">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-synth-gray-500">Detune</label>
                        <span className="text-xs font-mono text-white bg-synth-gray-700 px-2 py-0.5 rounded">
                            {settings.detune.toFixed(1)} Cents
                        </span>
                    </div>
                    <div className="w-11/12 mx-auto pt-1">
                        <input
                            type="range"
                            min={-25}
                            max={25}
                            step={1}
                            value={settings.detune}
                            onChange={(e) => handleDetuneChange(parseFloat(e.target.value))}
                            className="horizontal-slider"
                            aria-label="Detune"
                        />
                    </div>
                </div>

                {/* Octave Control */}
                <div className="flex flex-col items-center">
                     <div className="flex items-center gap-2 bg-synth-gray-700 rounded-full p-1">
                        <button onClick={() => handleOctaveChange(-1)} disabled={settings.octave <= -2} className="w-6 h-6 rounded-full bg-synth-gray-600 text-white font-bold hover:bg-synth-gray-500 disabled:opacity-50">-</button>
                        <span className="w-8 text-center text-base font-mono font-bold text-white tabular-nums">{settings.octave}</span>
                        <button onClick={() => handleOctaveChange(1)} disabled={settings.octave >= 2} className="w-6 h-6 rounded-full bg-synth-gray-600 text-white font-bold hover:bg-synth-gray-500 disabled:opacity-50">+</button>
                    </div>
                    <label className="text-sm font-medium text-synth-gray-500 mt-2">Octave</label>
                </div>
            </div>
        </div>
    );
};

const SampleLoader: React.FC<{ onSampleLoad?: (buffer: ArrayBuffer) => void }> = ({ onSampleLoad }) => {
    const [fileName, setFileName] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setFileName(file.name);
        
        if (onSampleLoad) {
            const arrayBuffer = await file.arrayBuffer();
            onSampleLoad(arrayBuffer);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                // Create blob from chunks
                const blob = new Blob(chunksRef.current);
                const arrayBuffer = await blob.arrayBuffer();
                
                if (onSampleLoad) onSampleLoad(arrayBuffer);
                setFileName("Recorded Sample");
                
                // Stop all tracks to release mic
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingDuration(0);
            timerRef.current = window.setInterval(() => {
                setRecordingDuration(prev => prev + 0.1);
            }, 100);

        } catch (err) {
            console.error("Microphone access error:", err);
            alert("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    return (
        <div className="grid grid-cols-2 gap-4 h-40 w-full">
            {/* Upload Area */}
            <div className="bg-synth-gray-900/50 p-4 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-synth-gray-700 hover:border-synth-purple-500 transition-colors relative group">
                <UploadIcon className="w-8 h-8 text-synth-gray-500 mb-1 group-hover:text-synth-purple-400 transition-colors" />
                <h3 className="text-sm font-semibold text-white">Upload File</h3>
                <label className="cursor-pointer mt-1 z-10">
                    <span className="px-3 py-1 bg-synth-gray-700 text-white text-xs font-bold rounded hover:bg-synth-gray-600 transition-colors">
                        Select .WAV
                    </span>
                    <input 
                        type="file" 
                        accept="audio/*" 
                        onChange={handleFileChange} 
                        className="hidden" 
                    />
                </label>
                {fileName && !isRecording && (
                    <div className="absolute bottom-2 left-2 right-2 px-2 py-0.5 bg-synth-gray-800 rounded text-synth-cyan-500 text-[10px] font-mono truncate text-center">
                        {fileName}
                    </div>
                )}
            </div>

            {/* Record Area */}
            <button 
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-4 rounded-lg flex flex-col items-center justify-center border-2 border-solid transition-all relative overflow-hidden group ${
                    isRecording 
                    ? 'bg-red-900/20 border-red-500 animate-pulse' 
                    : 'bg-synth-gray-900/50 border-synth-gray-700 hover:border-red-400 hover:bg-synth-gray-800'
                }`}
            >
                {isRecording ? (
                    <>
                         <div className="w-8 h-8 bg-red-500 rounded mb-1 shadow-[0_0_15px_rgba(239,68,68,0.7)]" />
                         <h3 className="text-sm font-bold text-red-400 tracking-wider">STOP</h3>
                         <span className="font-mono text-red-300 text-sm mt-1">{recordingDuration.toFixed(1)}s</span>
                    </>
                ) : (
                    <>
                        <MicrophoneIcon className="w-8 h-8 text-synth-gray-500 mb-1 group-hover:text-red-400 transition-colors" />
                        <h3 className="text-sm font-semibold text-white group-hover:text-red-100">Record Mic</h3>
                        <span className="text-xs text-synth-gray-500 group-hover:text-red-200">Click to Start</span>
                    </>
                )}
            </button>
        </div>
    );
};


// --- MAIN CONTROLS COMPONENT ---

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
  sampleLoop, onSampleLoopChange
}) => {
  const [scopeColorX, setScopeColorX] = useState('#00FFFF');
  const [scopeColorY, setScopeColorY] = useState('#8A2BE2');

  const handleAdsrChange = (param: keyof ADSREnvelope) => (value: number) => {
    setAdsr(prev => ({ ...prev, [param]: value }));
  };
  
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
      // When switching tabs, select the first preset in that category automatically
      const firstPreset = presetsByCategory[category][0];
      if (firstPreset) {
          onPresetChange(firstPreset);
      }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* --- PRESETS PANEL WITH TABS --- */}
      <div className="bg-synth-gray-800 p-4 rounded-lg space-y-4">
        <div className="flex flex-wrap gap-2 border-b border-synth-gray-700 pb-2 mb-2">
            {categories.map(category => (
                <button
                    key={category}
                    onClick={() => handleTabClick(category)}
                    className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors border-b-2 ${
                        activeCategory === category 
                        ? 'bg-synth-gray-700 text-white border-synth-cyan-500' 
                        : 'text-synth-gray-500 hover:text-white border-transparent hover:bg-synth-gray-700'
                    }`}
                >
                    {category}
                </button>
            ))}
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {presetsByCategory[activeCategory].map(preset => (
                <button 
                    key={preset.name} 
                    onClick={() => onPresetChange(preset)}
                    className={`p-2 rounded-md cursor-pointer transition-colors text-center text-sm ${
                        preset.name === activePresetName 
                        ? 'bg-synth-cyan-500 text-synth-gray-900 font-bold' 
                        : 'bg-synth-gray-700 hover:bg-synth-gray-600 text-white'
                    }`}
                >
                    {preset.name}
                </button>
            ))}
        </div>
      </div>

      {/* --- MAIN CONTROLS ROW --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        {/* Combined Oscillators & Mixer Panel OR Sample Editor */}
        <div className="bg-synth-gray-800 p-4 rounded-lg space-y-4 md:col-span-2 lg:col-span-2 flex flex-col">
            <h3 className="text-lg font-semibold text-white text-center">
                {isSamplingMode ? "Sample Editor" : "Sound Source"}
            </h3>
            
            {isSamplingMode ? (
                <div className="flex flex-col gap-4 h-full">
                     <div className="flex-shrink-0 w-full flex gap-4">
                        <div className="flex-grow">
                            <SampleLoader onSampleLoad={onSampleLoad} />
                        </div>
                         {onSampleVolumeChange && sampleVolume !== undefined && (
                            <div className="w-24 bg-synth-gray-900/50 rounded-lg p-2 flex flex-col items-center justify-center border-2 border-synth-gray-700">
                                <SliderControl 
                                    label="Volume" 
                                    value={sampleVolume} 
                                    min={0} 
                                    max={4.0} 
                                    step={0.01} 
                                    onChange={onSampleVolumeChange}
                                    showTooltip={showTooltips}
                                    tooltipText={`Volume: ${(sampleVolume * 100).toFixed(0)}%`}
                                />
                            </div>
                         )}
                     </div>
                     <div className="flex-grow bg-synth-gray-900/50 p-4 rounded-lg">
                        <SampleEditor 
                            audioBuffer={sampleBuffer ?? null} 
                            trimStart={trimStart} 
                            trimEnd={trimEnd} 
                            onTrimChange={onTrimChange} 
                            loop={sampleLoop ?? false}
                            onLoopChange={onSampleLoopChange ?? (() => {})}
                        />
                     </div>
                </div>
            ) : (
                <div className={`grid grid-cols-1 ${isSingleOscillatorMode ? 'sm:grid-cols-1' : 'sm:grid-cols-[2fr_1fr_2fr]'} gap-4 items-stretch flex-grow`}>
                    {/* Oscillator 1 */}
                    <div className="bg-synth-gray-900/50 p-4 rounded-lg">
                        <OscillatorPanel id={1} settings={osc1} onSettingsChange={setOsc1} isSingleOscillatorMode={isSingleOscillatorMode} />
                    </div>

                    {!isSingleOscillatorMode && (
                    <>
                        {/* Mixer */}
                        <div className="bg-synth-gray-900/50 p-4 rounded-lg flex flex-col items-center justify-center space-y-4">
                            <h3 className="text-lg font-semibold text-white">Mixer</h3>
                            <div className="flex-grow flex items-center justify-center">
                            <div className="w-16 h-full">
                                    <SliderControl label="Mix" value={oscMix} min={0} max={1} step={0.01} onChange={setOscMix} showTooltip={showTooltips} tooltipText={`OSC 1: ${(100 - oscMix * 100).toFixed(0)}% | OSC 2: ${(oscMix * 100).toFixed(0)}%`} />
                            </div>
                            </div>
                        </div>

                        {/* Oscillator 2 */}
                        <div className="bg-synth-gray-900/50 p-4 rounded-lg">
                            <OscillatorPanel id={2} settings={osc2} onSettingsChange={setOsc2} isSingleOscillatorMode={isSingleOscillatorMode} />
                        </div>
                    </>
                    )}
                </div>
            )}
        </div>

        {/* ADSR Envelope */}
        <div className="bg-synth-gray-800 p-4 rounded-lg space-y-4">
          <h3 className="text-lg font-semibold text-white">Envelope (ADSR)</h3>
          <EnvelopeVisualizer adsr={adsr} />
          <div className="grid grid-cols-4 gap-4 pt-2 h-36">
            <SliderControl label="Attack" value={adsr.attack} min={0.01} max={2} step={0.01} onChange={handleAdsrChange('attack')} showTooltip={showTooltips} tooltipText={`Attack: ${(adsr.attack * 1000).toFixed(0)} ms`} />
            <SliderControl label="Decay" value={adsr.decay} min={0.01} max={2} step={0.01} onChange={handleAdsrChange('decay')} showTooltip={showTooltips} tooltipText={`Decay: ${(adsr.decay * 1000).toFixed(0)} ms`} />
            <SliderControl label="Sustain" value={adsr.sustain} min={0} max={1} step={0.01} onChange={handleAdsrChange('sustain')} showTooltip={showTooltips} tooltipText={`Sustain: ${(adsr.sustain * 100).toFixed(0)}%`} />
            <SliderControl label="Release" value={adsr.release} min={0.01} max={4} step={0.01} onChange={handleAdsrChange('release')} showTooltip={showTooltips} tooltipText={`Release: ${(adsr.release * 1000).toFixed(0)} ms`} />
          </div>
        </div>

        {/* X/Y Scope */}
        <div className="bg-synth-gray-800 p-4 rounded-lg space-y-2 flex flex-col">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">X/Y Scope</h3>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-synth-gray-500 font-mono">
                        X
                        <input type="color" value={scopeColorX} onChange={(e) => setScopeColorX(e.target.value)} className="w-5 h-5 p-0 bg-transparent border-none rounded cursor-pointer" aria-label="X-axis color for scope line" />
                    </label>
                    <label className="flex items-center gap-1 text-xs text-synth-gray-500 font-mono">
                        Y
                        <input type="color" value={scopeColorY} onChange={(e) => setScopeColorY(e.target.value)} className="w-5 h-5 p-0 bg-transparent border-none rounded cursor-pointer" aria-label="Y-axis color for scope glow" />
                    </label>
                </div>
            </div>
            <div className="flex-grow bg-black rounded-sm overflow-hidden min-h-[200px]">
                <Lissajous analyserX={analyserX} analyserY={analyserY} colorX={scopeColorX} colorY={scopeColorY} />
            </div>
        </div>
      </div>
    </div>
  );
};
