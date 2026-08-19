import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AudioWaveformProps {
  stream: MediaStream | null;
  isActive: boolean;
  className?: string;
  barCount?: number;
  color?: string;
}

export const AudioWaveform = ({
  stream,
  isActive,
  className,
  barCount = 5,
  color = "currentColor",
}: AudioWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || !isActive || !canvasRef.current) {
      // Clear canvas when not active
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      return;
    }

    // Set up audio context and analyser
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      if (!isActive) return;
      
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate bar dimensions
      const barWidth = Math.floor(canvas.width / barCount) - 2;
      const barSpacing = 2;
      const maxHeight = canvas.height - 4;

      // Draw bars
      for (let i = 0; i < barCount; i++) {
        // Sample from different parts of the frequency spectrum
        const index = Math.floor((i / barCount) * bufferLength);
        const value = dataArray[index] || 0;
        
        // Normalize and add minimum height
        const normalizedValue = value / 255;
        const height = Math.max(4, normalizedValue * maxHeight);
        
        const x = i * (barWidth + barSpacing) + barSpacing;
        const y = (canvas.height - height) / 2;

        // Draw rounded bar
        ctx.fillStyle = color;
        ctx.beginPath();
        const radius = Math.min(barWidth / 2, 2);
        ctx.roundRect(x, y, barWidth, height, radius);
        ctx.fill();
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stream, isActive, barCount, color]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      width={barCount * 8}
      height={20}
      className={cn("", className)}
    />
  );
};
