import React, { useRef, useEffect } from 'react';

interface OscilloscopeProps {
  analyser: AnalyserNode | null;
}

// Define fixed dimensions for the canvas resolution. CSS will scale the display size.
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 100;

export const Oscilloscope: React.FC<OscilloscopeProps> = ({ analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyser) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context || !canvas) return;
    
    // Set the canvas resolution
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // The number of data points we'll collect is half the FFT size.
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    let animationFrameId: number;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);
      
      // Get the time-domain data for the waveform
      analyser.getFloatTimeDomainData(dataArray);

      // Clear the canvas with a black background color
      context.fillStyle = '#000000';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Set the style for the waveform line
      context.lineWidth = 2;
      context.strokeStyle = '#00FFFF'; // synth-cyan-500
      context.beginPath();

      const sliceWidth = canvas.width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        // Waveform values are from -1.0 to 1.0.
        const v = dataArray[i];
        // Map this value to a y-coordinate on the canvas.
        // Center of canvas is height / 2.
        const y = (v * canvas.height / 2) + (canvas.height / 2);

        if (i === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
        x += sliceWidth;
      }
      context.stroke();
    };

    draw();

    // Cleanup function to cancel the animation frame when the component unmounts
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyser]);

  return (
    <canvas ref={canvasRef} className="w-full h-full block"></canvas>
  );
};