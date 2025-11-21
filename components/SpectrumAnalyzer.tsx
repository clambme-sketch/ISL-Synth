
import React, { useRef, useEffect } from 'react';

interface SpectrumAnalyzerProps {
  analyser: AnalyserNode | null;
}

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 100;

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({ analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyser) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context || !canvas) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationFrameId: number;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      // Clear with a slight fade for trailing effect (optional, but clean is better for spectrum)
      context.fillStyle = '#000000';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i];
        // Scale height to fit canvas
        const scaledHeight = (barHeight / 255) * canvas.height;

        // Create gradient fill
        const gradient = context.createLinearGradient(0, canvas.height, 0, canvas.height - scaledHeight);
        gradient.addColorStop(0, 'rgba(138, 43, 226, 0.8)'); // Purple
        gradient.addColorStop(1, 'rgba(0, 255, 255, 1)'); // Cyan

        context.fillStyle = gradient;
        context.fillRect(x, canvas.height - scaledHeight, barWidth, scaledHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyser]);

  return (
    <canvas ref={canvasRef} className="w-full h-full block"></canvas>
  );
};
