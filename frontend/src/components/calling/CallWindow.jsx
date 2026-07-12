import React, { useEffect } from 'react';
import {
  FiMic, FiMicOff, FiVideo, FiVideoOff,
  FiPhoneOff
} from 'react-icons/fi';

const CallWindow = ({
  callState,
  mediaType,
  isMuted,
  isCameraOff,
  callDuration,
  localStream,
  remoteStream,
  localVideoRef,
  remoteVideoRef,
  onEndCall,
  onToggleMute,
  onToggleCamera,
  contactName,
}) => {
  // Bind local and remote streams directly when they are available or when refs mount
  useEffect(() => {
    if (localVideoRef.current && localVideoRef.current.srcObject !== localStream) {
      localVideoRef.current.srcObject = localStream || null;
    }
  }, [localVideoRef, localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
  }, [remoteVideoRef, remoteStream]);

  // Format call timer MM:SS
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Play synthesized ringtone sound for outgoing calls using Web Audio API
  useEffect(() => {
    if (callState !== 'outgoing') return;

    let audioCtx;
    let intervalId;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
      };
      playTone();
      intervalId = setInterval(playTone, 2500);
    } catch (e) {
      // Web Audio not available, skip ringtone
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (audioCtx) audioCtx.close().catch(() => {});
    };
  }, [callState]);

  return (
    <div className="calling-overlay-custom">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '90%',
        maxWidth: '960px',
      }}>
        {/* Call Status & Timer */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px', letterSpacing: '-0.5px' }}>
            {contactName || 'Unknown'}
          </h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.95rem', fontWeight: 500 }}>
            {callState === 'outgoing' && 'Ringing...'}
            {callState === 'connecting' && 'Connecting...'}
            {callState === 'connected' && formatDuration(callDuration)}
          </p>
        </div>

        {/* Video Feeds Grid */}
        <div className="video-feeds-grid">
          {/* Local Stream */}
          <div className="video-element-wrapper">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="video-feed-source"
              style={{
                opacity: isCameraOff ? 0.25 : 1,
                transition: 'opacity 0.3s ease',
              }}
            />
            <span style={{
              position: 'absolute',
              bottom: '14px',
              left: '14px',
              background: 'rgba(15, 10, 30, 0.6)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#ffffff',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              You
            </span>
          </div>

          {/* Remote Stream */}
          <div className="video-element-wrapper">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="video-feed-source remote"
            />
            <span style={{
              position: 'absolute',
              bottom: '14px',
              left: '14px',
              background: 'rgba(15, 10, 30, 0.6)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#ffffff',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              {contactName || 'Remote'}
            </span>
          </div>
        </div>

        {/* Call Controls */}
        <div style={{
          display: 'flex',
          gap: '20px',
          alignItems: 'center',
          marginTop: '25px',
        }}>
          {/* Mute Toggle */}
          <button
            onClick={onToggleMute}
            className={`circle-control-btn ${isMuted ? 'active' : 'inactive'}`}
            style={{ width: '56px', height: '56px', fontSize: '1.35rem' }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <FiMicOff /> : <FiMic />}
          </button>

          {/* Camera Toggle (only for video calls) */}
          {mediaType === 'video' && (
            <button
              onClick={onToggleCamera}
              className={`circle-control-btn ${isCameraOff ? 'active' : 'inactive'}`}
              style={{ width: '56px', height: '56px', fontSize: '1.35rem' }}
              title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isCameraOff ? <FiVideoOff /> : <FiVideo />}
            </button>
          )}

          {/* End Call */}
          <button
            onClick={onEndCall}
            className="circle-control-btn active"
            style={{
              width: '64px',
              height: '64px',
              fontSize: '1.5rem',
              background: 'var(--danger)',
              boxShadow: '0 6px 20px rgba(239, 68, 68, 0.45)'
            }}
            title="End Call"
          >
            <FiPhoneOff />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallWindow;
