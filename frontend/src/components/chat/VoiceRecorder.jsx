import React, { useState, useEffect, useRef } from 'react';
import { FiTrash2, FiMic, FiSquare, FiPlay, FiPause, FiSend } from 'react-icons/fi';

const VoiceRecorder = ({ onSend, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  
  // Preview Playback State
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const previewAudioRef = useRef(null);

  // Web Audio Visualizer Refs
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const mimeTypeRef = useRef('');

  // Dynamic MIME check helper
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
      'audio/aac',
      'audio/wav'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // browser default
  };

  const getExtensionForMimeType = (mimeType) => {
    if (mimeType.includes('webm')) return '.webm';
    if (mimeType.includes('ogg')) return '.ogg';
    if (mimeType.includes('mp4') || mimeType.includes('x-m4a') || mimeType.includes('aac')) return '.m4a';
    if (mimeType.includes('wav')) return '.wav';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return '.mp3';
    return '.webm'; // default fallback
  };

  // Start recording on mount
  useEffect(() => {
    startRecording();
    return () => {
      cleanupRecording();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer Effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Preview audio listeners
  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    previewAudioRef.current = audio;

    const handleLoadedMetadata = () => {
      setPreviewDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setPreviewTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlayingPreview(false);
      setPreviewTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  // Trigger visualizer loop when recording starts and canvas is mounted
  useEffect(() => {
    if (isRecording && canvasRef.current) {
      startVisualizer();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    chunksRef.current = [];
    setRecordingDuration(0);
    setAudioBlob(null);
    setAudioUrl('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = getSupportedMimeType();
      mimeTypeRef.current = mime;
      
      const options = mime ? { mimeType: mime } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mimeTypeRef.current || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
      };

      // Set up Web Audio Analyser
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      mediaRecorder.start(100); // chunk every 100ms
      setIsRecording(true);

    } catch (err) {
      console.error('Microphone access denied or error starting recording', err);
      alert('Could not access microphone. Please check permission settings.');
      onCancel();
    }
  };

  const startVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    if (!analyser) return;

    // Resolve color of CSS variable safely, falling back to brand hex if unresolved or invalid
    let primaryLight = '#9585f0';
    try {
      const computedValue = getComputedStyle(document.documentElement).getPropertyValue('--primary-light').trim();
      if (computedValue && !computedValue.startsWith('var') && !computedValue.includes('(')) {
        primaryLight = computedValue;
      }
    } catch (e) {
      console.warn('Failed to resolve --primary-light CSS variable', e);
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current) return;
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        // scale height to look nice on canvas
        barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        if (barHeight < 4) barHeight = 4; // minimum bar height

        const gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, 'rgba(184, 168, 255, 0.4)');
        gradient.addColorStop(1, primaryLight);
        
        canvasCtx.fillStyle = gradient;
        
        // draw rounded bars
        const y = (canvas.height - barHeight) / 2;
        
        // Custom draw of rounded rect
        canvasCtx.beginPath();
        canvasCtx.roundRect(x, y, barWidth - 2, barHeight, 2);
        canvasCtx.fill();

        x += barWidth;
      }
    };

    draw();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      cleanupRecording();
    }
  };

  const cleanupRecording = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleDiscard = () => {
    cleanupRecording();
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    onCancel();
  };

  const togglePreviewPlay = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    if (isPlayingPreview) {
      audio.pause();
      setIsPlayingPreview(false);
    } else {
      audio.play().catch(err => console.error('Preview playback failed', err));
      setIsPlayingPreview(true);
    }
  };

  const handlePreviewScrub = (e) => {
    const audio = previewAudioRef.current;
    if (!audio || !previewDuration) return;
    const value = parseFloat(e.target.value);
    audio.currentTime = value;
    setPreviewTime(value);
  };

  const handleSendRecording = () => {
    if (!audioBlob) return;
    
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }

    const mime = audioBlob.type || 'audio/webm';
    const ext = getExtensionForMimeType(mime);
    const audioFile = new File(
      [audioBlob],
      `voice_${Date.now()}${ext}`,
      { type: mime }
    );
    
    onSend(audioFile);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      flex: 1,
      width: '100%',
      background: 'rgba(255, 255, 255, 0.04)',
      border: '1px solid var(--glass-border)',
      borderRadius: '21px',
      padding: '0 15px',
      height: '42px'
    }}>
      {/* Discard recording */}
      <button
        type="button"
        onClick={handleDiscard}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--danger)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px',
          borderRadius: '50%',
          transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(248, 113, 113, 0.15)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        title="Discard Recording"
      >
        <FiTrash2 style={{ fontSize: '1.2rem' }} />
      </button>

      {/* Recording Phase vs Preview Phase */}
      {isRecording ? (
        <>
          {/* Pulsing red record indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--danger)',
            fontSize: '0.88rem',
            fontWeight: 600
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--danger)',
              animation: 'pulse 1.2s infinite'
            }} />
            <span style={{ fontFamily: 'monospace' }}>{formatDuration(recordingDuration)}</span>
          </div>

          {/* Audio Canvas Visualizer */}
          <canvas
            ref={canvasRef}
            width={200}
            height={30}
            style={{
              flex: 1,
              height: '24px',
              maxWidth: '300px'
            }}
          />

          {/* Stop and Preview Button */}
          <button
            type="button"
            onClick={stopRecording}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--glass-border)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-main)',
              transition: 'background 0.2s',
              marginLeft: 'auto'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            title="Stop & Preview"
          >
            <FiSquare style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }} />
          </button>
        </>
      ) : (
        <>
          {/* Preview Phase Player */}
          <button
            type="button"
            onClick={togglePreviewPlay}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary-light)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              borderRadius: '50%',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(184, 168, 255, 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            title={isPlayingPreview ? 'Pause' : 'Play Preview'}
          >
            {isPlayingPreview ? (
              <FiPause style={{ fontSize: '1.15rem' }} />
            ) : (
              <FiPlay style={{ fontSize: '1.15rem', marginLeft: '1px' }} />
            )}
          </button>

          {/* Audio Seek Scrubber */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flex: 1
          }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              {formatDuration(previewTime)}
            </span>
            
            <input
              type="range"
              min={0}
              max={previewDuration || 0}
              step={0.05}
              value={previewTime}
              onChange={handlePreviewScrub}
              style={{
                flex: 1,
                accentColor: 'var(--primary)',
                height: '4px',
                borderRadius: '2px',
                cursor: 'pointer'
              }}
            />
            
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              {formatDuration(previewDuration || 0)}
            </span>
          </div>

          {/* Send Recording Button */}
          <button
            type="button"
            onClick={handleSendRecording}
            style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(124, 110, 230, 0.3)',
              transition: 'transform 0.15s ease'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.9)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            title="Send Voice Message"
          >
            <FiSend style={{ fontSize: '0.9rem', color: '#ffffff' }} />
          </button>
        </>
      )}

      {/* Embedded CSS for pulse animation keyframe to avoid polluting global files */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};

export default VoiceRecorder;
