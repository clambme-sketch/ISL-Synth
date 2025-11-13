import React, { useRef, useEffect } from 'react';

interface LissajousProps {
  analyserX: AnalyserNode | null;
  analyserY: AnalyserNode | null;
  colorX: string;
  colorY: string;
}

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;
const FADE_AMOUNT = 0.15;
const LINE_WIDTH = 1; // Thinner core line for better definition
const GLOW_BLUR = 15; // Increased blur for a softer glow


export const Lissajous: React.FC<LissajousProps> = ({ analyserX, analyserY, colorX, colorY }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

      // Apply the fade effect to create trails
      context.fillStyle = `rgba(0, 0, 0, ${FADE_AMOUNT})`;
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Define the path for the waveform
      context.beginPath();
      const firstX = (dataArrayX[0] * canvas.width / 2) + (canvas.width / 2);
      const firstY = (dataArrayY[0] * canvas.height / 2) + (canvas.height / 2);
      context.moveTo(firstX, firstY);

      for (let i = 1; i < bufferLength; i++) {
        const x = (dataArrayX[i] * canvas.width / 2) + (canvas.width / 2);
        const y = (dataArrayY[i] * canvas.height / 2) + (canvas.height / 2);
        context.lineTo(x, y);
      }

      // 1. Draw the outer glow (Y color) first
      context.lineWidth = LINE_WIDTH * 4; // Thicker for the glow
      context.strokeStyle = colorY;
      context.shadowBlur = GLOW_BLUR;
      context.shadowColor = colorY;
      context.stroke();

      // 2. Draw the core line (X color) on top
      context.lineWidth = LINE_WIDTH;
      context.strokeStyle = colorX;
      context.shadowBlur = 0; // No shadow for the core line
      context.stroke();
      
      // Reset shadow for next frame's fade rectangle
      context.shadowBlur = 0;
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyserX, analyserY, colorX, colorY]);

  return (
    <canvas ref={canvasRef} className="w-full h-full block"></canvas>
  );
};