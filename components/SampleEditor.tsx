
import React, { useRef, useEffect, useState } from 'react';

interface SampleEditorProps {
  audioBuffer: AudioBuffer | null;
  trimStart: number;
  trimEnd: number;
  onTrimChange: (start: number, end: number) => void;
  loop?: boolean;
  onLoopChange?: (loop: boolean) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 120;

export const SampleEditor: React.FC<SampleEditorProps> = ({ audioBuffer, trimStart, trimEnd, onTrimChange, loop = false, onLoopChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const waveformDataRef = useRef<{ min: number; max: number }[]>([]);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);

  // 1. Process Waveform Data (Only when buffer changes)
  useEffect(() => {
    if (!audioBuffer) {
      waveformDataRef.current = [];
      return;
    }

    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / CANVAS_WIDTH);
    const points = [];

    for (let i = 0; i < CANVAS_WIDTH; i++) {
      let min = 1.0;
      let max = -1.0;
      const start = i * step;
      // Only sample a subset for performance if needed, but here we do simple min/max
      for (let j = 0; j < step; j++) {
        const datum = data[start + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      points.push({ min, max });
    }
    waveformDataRef.current = points;
  }, [audioBuffer]);

  // 2. Draw Waveform & Overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    if (!audioBuffer) {
        ctx.fillStyle = "#3D3D3D";
        ctx.font = "14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("No Sample Loaded", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        return;
    }

    const amp = CANVAS_HEIGHT / 2;
    const waveform = waveformDataRef.current;

    // Draw Base Waveform (Dimmed/Grey)
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#555'; 
    ctx.beginPath();
    for (let i = 0; i < waveform.length; i++) {
        const { min, max } = waveform[i];
        ctx.moveTo(i + 0.5, (1 + min) * amp);
        ctx.lineTo(i + 0.5, (1 + max) * amp);
    }
    ctx.stroke();

    // Draw Active Region Waveform (Bright Cyan)
    const startX = trimStart * CANVAS_WIDTH;
    const endX = trimEnd * CANVAS_WIDTH;
    
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00FFFF';
    ctx.beginPath();
    
    // Optimize loop to only draw active region
    const startIdx = Math.floor(trimStart * waveform.length);
    const endIdx = Math.ceil(trimEnd * waveform.length);

    for (let i = startIdx; i < endIdx; i++) {
        if (i < 0 || i >= waveform.length) continue;
        const { min, max } = waveform[i];
        ctx.moveTo(i + 0.5, (1 + min) * amp);
        ctx.lineTo(i + 0.5, (1 + max) * amp);
    }
    ctx.stroke();

    // Draw Dimmed Overlay for trimmed regions
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    // Left Dim
    ctx.fillRect(0, 0, startX, CANVAS_HEIGHT);
    // Right Dim
    ctx.fillRect(endX, 0, CANVAS_WIDTH - endX, CANVAS_HEIGHT);

  }, [audioBuffer, trimStart, trimEnd]);


  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent, type: 'start' | 'end') => {
      e.preventDefault();
      setIsDragging(type);
  };

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (!isDragging || !containerRef.current) return;
          
          const rect = containerRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percentage = Math.max(0, Math.min(1, x / rect.width));

          if (isDragging === 'start') {
              // Clamp start so it doesn't go past end
              const newStart = Math.min(percentage, trimEnd - 0.01);
              onTrimChange(newStart, trimEnd);
          } else {
              // Clamp end so it doesn't go before start
              const newEnd = Math.max(percentage, trimStart + 0.01);
              onTrimChange(trimStart, newEnd);
          }
      };

      const handleMouseUp = () => {
          setIsDragging(null);
      };

      if (isDragging) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }

      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isDragging, trimStart, trimEnd, onTrimChange]);


  return (
    <div className="flex flex-col w-full h-full gap-2 select-none">
        <div className="flex justify-between text-xs text-synth-gray-500 px-1 items-center">
            <div className="flex gap-4">
                <span>Start: {trimStart.toFixed(3)}</span>
                <span>End: {trimEnd.toFixed(3)}</span>
            </div>
            {onLoopChange && (
                <button
                    onClick={() => onLoopChange(!loop)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                        loop 
                        ? 'bg-synth-cyan-500 text-synth-gray-900 border-synth-cyan-400' 
                        : 'bg-synth-gray-800 text-synth-gray-500 border-synth-gray-600 hover:border-synth-gray-500'
                    }`}
                >
                    <div className={`w-2 h-2 rounded-full ${loop ? 'bg-synth-gray-900' : 'bg-synth-gray-500'}`} />
                    LOOP
                </button>
            )}
        </div>
        <div ref={containerRef} className="relative w-full h-[120px] bg-black rounded border border-synth-gray-700 cursor-crosshair overflow-hidden">
            <canvas 
                ref={canvasRef} 
                width={CANVAS_WIDTH} 
                height={CANVAS_HEIGHT} 
                className="w-full h-full block" 
            />
            
            {/* Start Handle */}
            <div 
                className="absolute top-0 bottom-0 w-1 bg-synth-cyan-500 hover:bg-white cursor-ew-resize z-10 group"
                style={{ left: `${trimStart * 100}%`, transform: 'translateX(-50%)' }}
                onMouseDown={(e) => handleMouseDown(e, 'start')}
            >
                 <div className="absolute top-0 -translate-x-1/2 -mt-1 w-0 h-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-synth-cyan-500 group-hover:border-t-white"></div>
                 <div className="absolute bottom-0 -translate-x-1/2 -mb-1 w-0 h-0 border-x-[6px] border-x-transparent border-b-[8px] border-b-synth-cyan-500 group-hover:border-b-white"></div>
            </div>

             {/* End Handle */}
             <div 
                className="absolute top-0 bottom-0 w-1 bg-synth-purple-500 hover:bg-white cursor-ew-resize z-10 group"
                style={{ left: `${trimEnd * 100}%`, transform: 'translateX(-50%)' }}
                onMouseDown={(e) => handleMouseDown(e, 'end')}
            >
                 <div className="absolute top-0 -translate-x-1/2 -mt-1 w-0 h-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-synth-purple-500 group-hover:border-t-white"></div>
                 <div className="absolute bottom-0 -translate-x-1/2 -mb-1 w-0 h-0 border-x-[6px] border-x-transparent border-b-[8px] border-b-synth-purple-500 group-hover:border-b-white"></div>
            </div>
        </div>
         <p className="text-xs text-synth-gray-500 text-center mt-1">
            Drag the handles to trim the sample start and end points.
        </p>
    </div>
  );
};
