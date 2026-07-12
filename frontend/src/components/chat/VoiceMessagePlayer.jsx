import React, { useState, useEffect, useRef } from 'react';
import { FiPlay, FiPause } from 'react-icons/fi';

const VoiceMessagePlayer = ({ src, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const audioRef = useRef(null);
  const waveformRef = useRef(null);

  // Deterministic heights for a professional voice wave appearance
  const waveHeights = [
    8, 16, 12, 24, 32, 20, 14, 28, 38, 44, 
    32, 26, 34, 46, 40, 22, 16, 26, 34, 28, 
    22, 16, 24, 28, 18, 12, 6
  ];

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration === Infinity) {
        audio.currentTime = 1e101;
        const handleTimeUpdateForDuration = () => {
          audio.currentTime = 0;
          setDuration(audio.duration);
          audio.removeEventListener('timeupdate', handleTimeUpdateForDuration);
        };
        audio.addEventListener('timeupdate', handleTimeUpdateForDuration);
      } else {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    // Trigger loading if not loaded (sometimes browsers prefetch metadata)
    if (audio.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      
      if (window.activeNovaChatAudio === audio) {
        window.activeNovaChatAudio = null;
      }
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // Pause any other active audio player in the app
      if (window.activeNovaChatAudio && window.activeNovaChatAudio !== audioRef.current) {
        window.activeNovaChatAudio.pause();
      }
      window.activeNovaChatAudio = audioRef.current;
      audioRef.current.play().catch(err => {
        console.error('Failed to play voice message', err);
      });
    }
  };

  const handleWaveformClick = (e) => {
    if (!audioRef.current || !duration || !waveformRef.current) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickPercent = Math.max(0, Math.min(1, clickX / width));
    
    audioRef.current.currentTime = clickPercent * duration;
    setCurrentTime(clickPercent * duration);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Color configurations based on whether the message is sent by me or received
  const playBtnBg = isMe ? 'rgba(255, 255, 255, 0.25)' : 'var(--primary)';
  const playBtnColor = '#ffffff';
  const activeWaveColor = isMe ? '#ffffff' : 'var(--primary)';
  const inactiveWaveColor = isMe ? 'rgba(255, 255, 255, 0.35)' : 'rgba(124, 58, 237, 0.15)';
  const textColor = isMe ? 'rgba(255, 255, 255, 0.85)' : 'var(--text-secondary)';

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 14px',
      minWidth: '260px',
      maxWidth: '320px',
      borderRadius: '12px',
      background: 'transparent',
      userSelect: 'none'
    }}>
      {/* Play/Pause round button */}
      <button
        onClick={togglePlay}
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          border: 'none',
          background: playBtnBg,
          color: playBtnColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          transition: 'transform 0.15s ease, background-color 0.2s ease',
          outline: 'none'
        }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.9)'; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <FiPause style={{ fontSize: '1.1rem' }} />
        ) : (
          <FiPlay style={{ fontSize: '1.1rem', marginLeft: '2px' }} />
        )}
      </button>

      {/* Waveform and Timers container */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        justifyContent: 'center'
      }}>
        {/* Clickable Waveform wrapper */}
        <div
          ref={waveformRef}
          onClick={handleWaveformClick}
          style={{
            height: '46px',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            cursor: 'pointer',
            position: 'relative'
          }}
        >
          {waveHeights.map((height, index) => {
            const barProgress = index / waveHeights.length;
            const isActive = progress >= barProgress;
            return (
              <div
                key={index}
                style={{
                  flex: 1,
                  height: `${height}px`,
                  borderRadius: '1.5px',
                  background: isActive ? activeWaveColor : inactiveWaveColor,
                  transition: 'background-color 0.1s ease',
                  maxHeight: '100%'
                }}
              />
            );
          })}
        </div>

        {/* Time track display */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          fontWeight: 500,
          color: textColor
        }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration || 0)}</span>
        </div>
      </div>
    </div>
  );
};

export default VoiceMessagePlayer;
