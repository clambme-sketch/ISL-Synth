import React, { useRef, useEffect } from 'react';

interface SpectrumAnalyzerProps {
  analyser: AnalyserNode | null;
}

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 100;

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({ analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef({ accent: '0 255 255', secondary: '138 43 226' });

  // Update theme colors when component mounts or updates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const computedStyle = getComputedStyle(canvas);
    // Fallback to default hex if var is missing
    const accent = computedStyle.getPropertyValue('--accent-500').trim() || '0 255 255';
    const secondary = computedStyle.getPropertyValue('--secondary-500').trim() || '138 43 226';
    
    colorsRef.current = { accent, secondary };
  }); // Runs on every render to catch theme updates

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

      context.fillStyle = '#000000';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;
      
      const { accent, secondary } = colorsRef.current;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i];
        const scaledHeight = (barHeight / 255) * canvas.height;

        const gradient = context.createLinearGradient(0, canvas.height, 0, canvas.height - scaledHeight);
        
        try {
            gradient.addColorStop(0, `rgb(${secondary} / 0.8)`);
            gradient.addColorStop(1, `rgb(${accent} / 1)`);
        } catch (e) {
            gradient.addColorStop(0, '#8A2BE2');
            gradient.addColorStop(1, '#00FFFF');
        }

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