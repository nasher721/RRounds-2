import { useState, useRef, useCallback, useEffect } from 'react';
import { getUserFacingErrorMessage, UserFacingError } from '@/lib/userFacingErrors';

export interface CameraScannerProps {
  /** Callback when an image is captured */
  onCapture: (imageData: string) => void;
  /** Callback when scanning fails */
  onError?: (error: Error) => void;
  /** Enable document edge detection (requires additional processing) */
  detectEdges?: boolean;
  /** Video constraints for camera */
  videoConstraints?: MediaTrackConstraints;
  /** CSS class name */
  className?: string;
}

export interface ScanResult {
  /** Base64 encoded image data */
  imageData: string;
  /** Timestamp of capture */
  capturedAt: Date;
  /** Whether edge detection was used */
  edgesDetected?: boolean;
  /** Detected document corners if edge detection enabled */
  corners?: { x: number; y: number }[];
}

interface DetectedEdges {
  corners: { x: number; y: number }[];
  confidence: number;
}

export function CameraScanner({
  onCapture,
  onError,
  detectEdges = false,
  videoConstraints,
  className = '',
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isActive, setIsActive] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setPermissionDenied(false);
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          ...videoConstraints,
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setHasPermission(true);
      setIsActive(true);
    } catch (err) {
      const denied = err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      const message = denied
        ? 'Camera access was denied. Enable camera access in browser settings, then retry.'
        : getUserFacingErrorMessage(
          err,
          'Camera could not start. Check that a camera is connected and not in use, then retry.',
        );
      setError(message);
      setPermissionDenied(denied);
      setHasPermission(false);
      onError?.(new UserFacingError(message));
    }
  }, [facingMode, videoConstraints, onError]);

  const detectDocumentEdges = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number): DetectedEdges | null => {
    // Simple edge detection using contrast analysis
    // In production, use a library like OpenCV.js or TensorFlow.js
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Convert to grayscale and find edges
    const grayscale = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      grayscale[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    
    // Simple corner detection - look for high contrast areas near corners
    const margin = 50;
    const cornerSize = 100;
    
    const corners = [
      { x: margin, y: margin }, // top-left
      { x: width - margin, y: margin }, // top-right
      { x: margin, y: height - margin }, // bottom-left
      { x: width - margin, y: height - margin }, // bottom-right
    ];
    
    // Check corner regions for document-like contrast
    let confidence = 0;
    for (const corner of corners) {
      const contrast = calculateCornerContrast(grayscale, width, corner, cornerSize);
      confidence += contrast;
    }
    confidence /= 4;
    
    if (confidence > 30) {
      return { corners, confidence };
    }
    
    return null;
  }, []);

  const calculateCornerContrast = (
    grayscale: Uint8Array,
    width: number,
    corner: { x: number; y: number },
    size: number
  ): number => {
    let sum = 0;
    let count = 0;
    
    for (let dy = 0; dy < size; dy += 5) {
      for (let dx = 0; dx < size; dx += 5) {
        const x = corner.x + dx;
        const y = corner.y + dy;
        if (x < width && y * width + x < grayscale.length) {
          const idx = y * width + x;
          if (grayscale[idx] > 128) sum++;
          count++;
        }
      }
    }
    
    return count > 0 ? (sum / count) * 100 : 0;
  };

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    const { videoWidth, videoHeight } = video;
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    
    let edgesDetected = false;
    let corners: { x: number; y: number }[] | undefined;
    
    if (detectEdges) {
      const edges = detectDocumentEdges(ctx, videoWidth, videoHeight);
      if (edges) {
        edgesDetected = true;
        corners = edges.corners;
      }
    }

    const result: ScanResult = {
      imageData,
      capturedAt: new Date(),
      edgesDetected,
      corners,
    };

    onCapture(result.imageData);
  }, [detectEdges, detectDocumentEdges, onCapture]);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (hasPermission !== false) {
      startCamera();
    }
  }, [facingMode, hasPermission, startCamera]);

  if (hasPermission === false) {
    return (
      <div className={`camera-scanner error ${className}`}>
        <div className="error-message">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
          <p>{permissionDenied ? 'Camera access denied' : 'Camera unavailable'}</p>
          <p className="hint">{error}</p>
          <button type="button" onClick={startCamera}>Retry camera</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`camera-scanner ${className}`}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ display: isActive ? 'block' : 'none' }}
      />
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {error && (
        <div className="camera-error">
          <p>{error}</p>
          <button onClick={startCamera}>Retry</button>
        </div>
      )}
      
      <div className="camera-controls">
        <button
          type="button"
          onClick={capture}
          disabled={!isActive}
          className="capture-button"
          aria-label="Capture image"
        >
          <span className="capture-icon" />
        </button>
        
        <button
          type="button"
          onClick={switchCamera}
          disabled={!isActive}
          className="switch-camera-button"
          aria-label="Switch camera"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <path d="M10 8l-4 4h3v6h2v-6h3l-4-4z"/>
          </svg>
        </button>
      </div>
      
      <style>{`
        .camera-scanner {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 300px;
          background: #000;
          border-radius: 12px;
          overflow: hidden;
        }
        
        .camera-scanner video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .camera-scanner.error {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #1a1a1a;
        }
        
        .error-message {
          text-align: center;
          color: #666;
          padding: 24px;
        }
        
        .error-message svg {
          margin-bottom: 16px;
          opacity: 0.5;
        }
        
        .error-message p {
          margin: 0;
        }
        
        .error-message .hint {
          font-size: 14px;
          margin-top: 8px;
          color: #999;
        }
        
        .camera-controls {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .capture-button {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          border: 4px solid #fff;
          background: transparent;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s;
        }
        
        .capture-button:active:not(:disabled) {
          transform: scale(0.95);
          background: rgba(255, 255, 255, 0.3);
        }
        
        .capture-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .capture-icon {
          display: block;
          width: 48px;
          height: 48px;
          margin: 8px auto;
          border-radius: 50%;
          background: #fff;
        }
        
        .switch-camera-button {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          background: rgba(0, 0, 0, 0.5);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        
        .switch-camera-button:hover:not(:disabled) {
          background: rgba(0, 0, 0, 0.7);
        }
        
        .switch-camera-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .camera-error {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          color: #fff;
        }
        
        .camera-error button {
          margin-top: 12px;
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          background: #3b82f6;
          color: #fff;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
