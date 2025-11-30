
import React, { useState, useRef, useEffect } from 'react';
import { UploadIcon, MicrophoneIcon } from './icons';
import { SampleEditor } from './SampleEditor';
import { SliderControl, RotaryKnob } from './Knob';

interface SampleSectionProps {
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
    showTooltips: boolean;
}

const SampleLoader: React.FC<{ onSampleLoad?: (buffer: ArrayBuffer) => void }> = ({ onSampleLoad }) => {
    const [fileName, setFileName] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
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
                const blob = new Blob(chunksRef.current);
                const arrayBuffer = await blob.arrayBuffer();
                if (onSampleLoad) onSampleLoad(arrayBuffer);
                setFileName("Recorded Sample");
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
        <div className="grid grid-cols-2 gap-4 h-full w-full">
            <div className="bg-synth-gray-900/50 p-2 rounded-lg flex flex-col items-center justify-center border border-dashed border-synth-gray-700 hover:border-[rgb(var(--accent-500))] transition-colors relative group">
                <UploadIcon className="w-6 h-6 text-synth-gray-500 mb-1 group-hover:text-[rgb(var(--accent-500))] transition-colors" />
                <label className="cursor-pointer mt-1 z-10 text-center">
                    <span className="text-[10px] font-bold text-white bg-synth-gray-700 px-2 py-1 rounded hover:bg-synth-gray-600">Select .WAV</span>
                    <input type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
                </label>
                {fileName && !isRecording && (
                    <div className="absolute bottom-1 left-1 right-1 px-1 bg-synth-gray-800 rounded text-[rgb(var(--accent-500))] text-[8px] font-mono truncate text-center">
                        {fileName}
                    </div>
                )}
            </div>

            <button 
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-2 rounded-lg flex flex-col items-center justify-center border transition-all relative overflow-hidden group ${
                    isRecording 
                    ? 'bg-red-900/20 border-red-500 animate-pulse' 
                    : 'bg-synth-gray-900/50 border-synth-gray-700 hover:border-red-400'
                }`}
            >
                {isRecording ? (
                    <>
                         <div className="w-6 h-6 bg-red-500 rounded mb-1 shadow-[0_0_10px_rgba(239,68,68,0.7)]" />
                         <span className="font-mono text-red-300 text-xs mt-1">{recordingDuration.toFixed(1)}s</span>
                    </>
                ) : (
                    <>
                        <MicrophoneIcon className="w-6 h-6 text-synth-gray-500 mb-1 group-hover:text-red-400" />
                        <h3 className="text-xs font-semibold text-white group-hover:text-red-100">Record</h3>
                    </>
                )}
            </button>
        </div>
    );
};

export const SampleSection: React.FC<SampleSectionProps> = ({
    onSampleLoad, sampleBuffer, trimStart, trimEnd, onTrimChange,
    sampleVolume, onSampleVolumeChange, sampleLoop, onSampleLoopChange,
    sampleBpm, onSampleBpmChange, showTooltips
}) => {
    return (
        <div className="bg-synth-gray-800 p-4 rounded-lg flex flex-col gap-4 h-full">
            <h3 className="text-lg font-semibold text-white">Sample Editor</h3>
            <div className="flex flex-col md:flex-row gap-4 h-full">
                <div className="w-full md:w-1/3 flex flex-col gap-2">
                    <div className="h-28">
                        <SampleLoader onSampleLoad={onSampleLoad} />
                    </div>
                    <div className="flex gap-2 h-24">
                         {onSampleVolumeChange && sampleVolume !== undefined && (
                            <div className="flex-1 bg-synth-gray-900/50 rounded-lg p-2 border border-synth-gray-700">
                                <RotaryKnob 
                                    label="Level" 
                                    value={sampleVolume} 
                                    defaultValue={0.5}
                                    min={0} max={2.0} step={0.01} 
                                    onChange={onSampleVolumeChange} 
                                    showTooltip={showTooltips}
                                    tooltipText={`Volume: ${(sampleVolume * 100).toFixed(0)}%`}
                                />
                            </div>
                         )}
                         {onSampleBpmChange && sampleBpm !== undefined && (
                             <div className="flex-1 bg-synth-gray-900/50 rounded-lg p-2 border border-synth-gray-700 flex flex-col items-center justify-center">
                                 <label className="text-[10px] font-bold text-synth-gray-500 mb-1 uppercase">Orig BPM</label>
                                 <input
                                     type="number"
                                     value={sampleBpm}
                                     onChange={(e) => onSampleBpmChange(Math.max(1, parseInt(e.target.value) || 120))}
                                     className="w-full bg-synth-gray-700 border border-synth-gray-600 rounded text-center text-white text-sm py-1 outline-none focus:border-[rgb(var(--accent-500))]"
                                 />
                             </div>
                         )}
                    </div>
                </div>
                <div className="flex-grow bg-synth-gray-900/50 p-2 rounded-lg border border-synth-gray-700 flex flex-col">
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
        </div>
    );
};
