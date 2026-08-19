import { useState, useRef, useCallback, useEffect } from 'react';

export interface VoiceInputProps {
  /** Callback when speech is recognized */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** Callback when there's an error */
  onError?: (error: Error) => void;
  /** Language to recognize (default: en-US) */
  language?: string;
  /** Enable continuous recognition */
  continuous?: boolean;
  /** Show visual feedback */
  showVisualizer?: boolean;
  /** CSS class name */
  className?: string;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
  onstart: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function VoiceInput({
  onTranscript,
  onError,
  language = 'en-US',
  continuous = false,
  showVisualizer = true,
  className = '',
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionAPI);

    if (!SpeechRecognitionAPI) {
      onError?.(new Error('Speech recognition not supported in this browser'));
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [onError]);

  const updateAudioLevel = useCallback(async () => {
    if (!analyserRef.current || !isListening) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setAudioLevel(average / 255);

    if (isListening) {
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isListening]);

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setTranscript(currentTranscript);
      
      if (finalTranscript) {
        onTranscript(finalTranscript, true);
      } else if (interimTranscript) {
        onTranscript(interimTranscript, false);
      }
    };

    recognition.onerror = (event) => {
      const error = new Error(`Speech recognition error: ${event.error}`);
      setIsListening(false);
      onError?.(error);
    };

    recognition.onend = () => {
      setIsListening(false);
      setAudioLevel(0);
    };

    recognitionRef.current = recognition;
    recognition.start();

    if (showVisualizer) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const audioContext = new AudioContext();
          const analyser = audioContext.createAnalyser();
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);
          analyser.fftSize = 256;
          
          audioContextRef.current = audioContext;
          analyserRef.current = analyser;
          
          updateAudioLevel();
        })
        .catch(err => {
          console.warn('Could not access microphone for visualizer:', err);
        });
    }
  }, [continuous, language, showVisualizer, onTranscript, onError, updateAudioLevel]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsListening(false);
    setAudioLevel(0);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  if (isSupported === false) {
    return (
      <div className={`voice-input unsupported ${className}`}>
        <p>Voice input is not supported in this browser</p>
        <p className="hint">Try using Chrome or Edge</p>
      </div>
    );
  }

  return (
    <div className={`voice-input ${className}`}>
      <button
        type="button"
        onClick={toggleListening}
        className={`voice-button ${isListening ? 'listening' : ''}`}
        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>

      {showVisualizer && isListening && (
        <div className="audio-visualizer">
          <div 
            className="audio-level"
            style={{ width: `${audioLevel * 100}%` }}
          />
        </div>
      )}

      {transcript && (
        <div className="transcript-preview">
          {transcript}
        </div>
      )}

      {isListening && (
        <div className="listening-indicator">
          <span className="pulse" />
          <span>Listening...</span>
        </div>
      )}

      <style>{`
        .voice-input {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        
        .voice-input.unsupported {
          padding: 24px;
          text-align: center;
          color: #666;
        }
        
        .voice-input.unsupported .hint {
          font-size: 14px;
          color: #999;
        }
        
        .voice-button {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: none;
          background: #3b82f6;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, background 0.2s, box-shadow 0.2s;
        }
        
        .voice-button:hover {
          background: #2563eb;
        }
        
        .voice-button.listening {
          background: #ef4444;
          box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          animation: pulse-button 1.5s infinite;
        }
        
        @keyframes pulse-button {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }
        
        .audio-visualizer {
          width: 100%;
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          overflow: hidden;
        }
        
        .audio-level {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ef4444);
          transition: width 0.05s ease-out;
        }
        
        .transcript-preview {
          max-width: 300px;
          padding: 12px;
          background: #f3f4f6;
          border-radius: 8px;
          font-size: 14px;
          color: #374151;
          word-break: break-word;
        }
        
        .listening-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #ef4444;
        }
        
        .pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          animation: pulse-dot 1s ease-in-out infinite;
        }
        
        @keyframes pulse-dot {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
