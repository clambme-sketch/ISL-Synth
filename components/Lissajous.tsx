
import React, { useRef, useEffect } from 'react';

interface LissajousProps {
  analyserX: AnalyserNode | null;
  analyserY: AnalyserNode | null;
  colorX?: string; // Optional, defaults to theme
  colorY?: string; // Optional, defaults to theme
}

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;
const FADE_AMOUNT = 0.15;
const LINE_WIDTH = 1; 
const GLOW_BLUR = 15; 

export const Lissajous: React.FC<LissajousProps> = ({ analyserX, analyserY, colorX, colorY }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef({ x: '#00FFFF', y: '#8A2BE2' });

  // Update theme colors when props or theme changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const computedStyle = getComputedStyle(canvas);
    const accentRaw = computedStyle.getPropertyValue('--accent-500').trim();
    const secondaryRaw = computedStyle.getPropertyValue('--secondary-500').trim();

    // Helper to resolve CSS variables if they are passed in the prop string
    const resolveColor = (val?: string) => {
      if (!val) return undefined;
      if (val.includes('var(')) {
           const varNameMatch = val.match(/--[\w-]+/);
           if (varNameMatch) {
               const resolved = computedStyle.getPropertyValue(varNameMatch[0]).trim();
               if (resolved) return `rgb(${resolved})`;
           }
      }
      return val;
    };

    const cX = resolveColor(colorX) || (accentRaw ? `rgb(${accentRaw})` : '#00FFFF');
    const cY = resolveColor(colorY) || (secondaryRaw ? `rgb(${secondaryRaw})` : '#8A2BE2');
    
    colorsRef.current = { x: cX, y: cY };

  }); // Removed dependency array to ensure it runs on every render to catch CSS var changes

  useEffect(() => {
    if (!analyserX || !analyserY) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context || !canvas) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const bufferLength = analyserX.frequencyBinCount;
    const dataArrayX = new Float32Array(bufferLength);
    const dataArrayY = new Float32Array(bufferLength);

    let animationFrameId: number;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);

      analyserX.getFloatTimeDomainData(dataArrayX);
      analyserY.getFloatTimeDomainData(dataArrayY);

      context.fillStyle = `rgba(0, 0, 0, ${FADE_AMOUNT})`;
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      const { x: cX, y: cY } = colorsRef.current;

      context.beginPath();
      const firstX = (dataArrayX[0] * canvas.width / 2) + (canvas.width / 2);
      const firstY = (dataArrayY[0] * canvas.height / 2) + (canvas.height / 2);
      context.moveTo(firstX, firstY);

      for (let i = 1; i < bufferLength; i++) {
        const x = (dataArrayX[i] * canvas.width / 2) + (canvas.width / 2);
        const y = (dataArrayY[i] * canvas.height / 2) + (canvas.height / 2);
        context.lineTo(x, y);
      }

      // Draw the outer glow (using Secondary/Y color)
      context.lineWidth = LINE_WIDTH * 4;
      context.strokeStyle = cY;
      context.shadowBlur = GLOW_BLUR;
      context.shadowColor = cY;
      context.stroke();

      // Draw the core line (using Primary/X color)
      context.lineWidth = LINE_WIDTH;
      context.strokeStyle = cX;
      context.shadowBlur = 0; 
      context.stroke();
      
      context.shadowBlur = 0;
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyserX, analyserY]);

  return (
    <canvas ref={canvasRef} className="w-full h-full block"></canvas>
  );
};
