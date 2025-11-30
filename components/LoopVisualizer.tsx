
import React, { useRef, useEffect } from 'react';

interface LoopVisualizerProps {
  audioBuffer: AudioBuffer | null;
  progress: number;
}

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 64; // Corresponds to h-16 in Tailwind

export const LoopVisualizer: React.FC<LoopVisualizerProps> = ({ audioBuffer, progress }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformDataRef = useRef<{ min: number; max: number }[]>([]);
  const progressRef = useRef(progress);

  // Keep progressRef updated
  useEffect(() => {
      progressRef.current = progress;
  }, [progress]);

  // 1. Pre-process the audio buffer into drawable data points whenever it changes.
  useEffect(() => {
    if (!audioBuffer) {
      waveformDataRef.current = [];
      return;
    }

    const data = audioBuffer.getChannelData(0); // Use the first channel
    const step = Math.ceil(data.length / CANVAS_WIDTH);
    const points = [];

    for (let i = 0; i < CANVAS_WIDTH; i++) {
      let min = 1.0;
      let max = -1.0;
      const start = i * step;
      for (let j = 0; j < step; j++) {
        const datum = data[start + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      points.push({ min, max });
    }
    waveformDataRef.current = points;
  }, [audioBuffer]);

  // 2. Use a dedicated animation loop that reads from the Ref
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationFrameId: number;

    const draw = () => {
      // Clear canvas for the next frame
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      const waveform = waveformDataRef.current;
      const currentProgress = progressRef.current;
      const isPlaying = currentProgress > 0 && currentProgress < 1;

      // Draw the waveform if data is available
      if (waveform.length > 0) {
        const amp = CANVAS_HEIGHT / 2;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00FFFF'; // synth-cyan-500

        ctx.beginPath();
        for (let i = 0; i < waveform.length; i++) {
          const { min, max } = waveform[i];
          // Draw a vertical line representing the min/max amplitude for this segment
          ctx.moveTo(i + 0.5, (1 + min) * amp);
          ctx.lineTo(i + 0.5, (1 + max) * amp);
        }
        ctx.stroke();
      }

      // Draw progress cursor if playing
      if (isPlaying) {
        const x = currentProgress * CANVAS_WIDTH;
        ctx.strokeStyle = '#FBBF24'; // amber-400, a nice yellow for the cursor
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      
      animationFrameId = requestAnimationFrame(draw);
    };

    draw(); // Start loop

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []); // Run ONCE on mount

  return (
    <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT} 
        className="w-full h-full block rounded"
        aria-label="Audio waveform of the recorded loop"
    />
  );
};
