import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiSend, FiCamera, FiVideo, FiFileText, FiSearch, FiVolume2, FiRotateCcw } from 'react-icons/fi';
import api from '../../services/api';

// Helper to format bytes to human readable sizes
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/* ============================================================================
   1. FilePreviewModal
   Previewing Photos, Videos, Audio, and Documents before sending
   ============================================================================ */
export const FilePreviewModal = ({ file, type, onCancel, onSend }) => {
  const [caption, setCaption] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSend(file, caption);
  };

  if (!file) return null;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Preview Attachment</h3>
          <button onClick={onCancel} style={styles.closeBtn} title="Cancel">
            <FiX />
          </button>
        </div>

        {/* Content Preview Container */}
        <div style={styles.previewContainer}>
          {type === 'image' && (
            <img src={previewUrl} alt="Preview" style={styles.mediaPreview} />
          )}

          {type === 'video' && (
            <video src={previewUrl} controls style={styles.mediaPreview} />
          )}

          {type === 'audio' && (
            <div style={styles.audioPreviewWrapper}>
              <div style={styles.audioIconCircle}>
                <FiVolume2 style={{ fontSize: '2.5rem', color: 'var(--accent-primary)' }} />
              </div>
              <audio src={previewUrl} controls style={styles.audioControls} />
            </div>
          )}

          {type === 'document' && (
            <div style={styles.documentPreviewWrapper}>
              <FiFileText style={{ fontSize: '4rem', color: 'var(--accent-primary)', marginBottom: '10px' }} />
              <div style={styles.docName}>{file.name}</div>
              <div style={styles.docSize}>{formatBytes(file.size)}</div>
            </div>
          )}
        </div>

        {/* Caption & Controls */}
        <form onSubmit={handleSubmit} style={styles.previewForm}>
          <input
            type="text"
            className="glass-input"
            placeholder="Add a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            style={styles.captionInput}
            autoFocus
          />
          <div style={styles.formActions}>
            <button type="button" onClick={onCancel} className="glass-btn" style={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" className="glass-btn" style={styles.sendBtn}>
              <FiSend style={{ marginRight: '6px' }} /> Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
   2. CameraModal
   Capture Photo or Record Video directly from camera
   ============================================================================ */
export const CameraModal = ({ onCancel, onSend }) => {
  const [mode, setMode] = useState('photo'); // photo | video
  const [stream, setStream] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedType, setCapturedType] = useState(''); // image | video
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [permissionError, setPermissionError] = useState('');
  const [caption, setCaption] = useState('');

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // Initialize camera stream
  useEffect(() => {
    const startCamera = async () => {
      try {
        const constraints = {
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: true
        };
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Camera access failed', err);
        setPermissionError('Could not access your camera/microphone. Please ensure permissions are granted.');
      }
    };

    if (!capturedBlob) {
      startCamera();
    }

    return () => {
      stopTracks();
      stopTimer();
    };
  }, [capturedBlob]);

  const stopTracks = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Switch between camera modes
  const handleModeChange = (newMode) => {
    if (isRecording) return;
    setMode(newMode);
  };

  // Snaps photo from video frame
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext('2d');
    // Mirror the preview to make it natural for user
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera_${Date.now()}.png`, { type: 'image/png' });
        setCapturedBlob(file);
        setCapturedType('image');
        stopTracks();
      }
    }, 'image/png');
  };

  // Start recording video chunks
  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    setIsRecording(true);
    setRecordingSeconds(0);

    // Filter audio tracks out if recorder fails, or record both
    let mediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
    } catch (e1) {
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      } catch (e2) {
        mediaRecorder = new MediaRecorder(stream);
      }
    }
      
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
      setCapturedBlob(file);
      setCapturedType('video');
      stopTracks();
    };

    mediaRecorder.start();

    // Start counter timer
    timerRef.current = setInterval(() => {
      setRecordingSeconds(prev => prev + 1);
    }, 1000);
  };

  // Stop recording
  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    stopTimer();
  };

  const handleRetake = () => {
    setCapturedBlob(null);
    setCapturedType('');
    setCaption('');
  };

  const handleSendCaptured = () => {
    if (capturedBlob) {
      onSend(capturedBlob, caption, capturedType);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCardLarge}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Camera Capture</h3>
          <button onClick={onCancel} style={styles.closeBtn} disabled={isRecording}>
            <FiX />
          </button>
        </div>

        {permissionError ? (
          <div style={styles.errorContainer}>
            <p style={styles.errorText}>{permissionError}</p>
            <button onClick={onCancel} className="glass-btn" style={styles.errorCloseBtn}>Close</button>
          </div>
        ) : (
          <div style={styles.cameraMainBody}>
            {/* Live Camera View OR Captured Preview */}
            {!capturedBlob ? (
              <div style={styles.videoStreamContainer}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    ...styles.cameraStream,
                    transform: 'scaleX(-1)' // Mirror preview for natural user experience
                  }}
                />
                
                {/* Mode indicators overlay */}
                <div style={styles.cameraModesOverlay}>
                  <button
                    onClick={() => handleModeChange('photo')}
                    style={{
                      ...styles.modeToggleBtn,
                      color: mode === 'photo' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.6)',
                      background: mode === 'photo' ? 'rgba(255,255,255,0.1)' : 'transparent'
                    }}
                    disabled={isRecording}
                  >
                    <FiCamera style={{ marginRight: '6px' }} /> Photo
                  </button>
                  <button
                    onClick={() => handleModeChange('video')}
                    style={{
                      ...styles.modeToggleBtn,
                      color: mode === 'video' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.6)',
                      background: mode === 'video' ? 'rgba(255,255,255,0.1)' : 'transparent'
                    }}
                    disabled={isRecording}
                  >
                    <FiVideo style={{ marginRight: '6px' }} /> Video
                  </button>
                </div>

                {/* Live controller shutters */}
                <div style={styles.shutterContainer}>
                  {mode === 'photo' ? (
                    <button onClick={capturePhoto} style={styles.shutterBtnPhoto} title="Take Photo" />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      {isRecording && (
                        <div style={styles.recordingTimer}>
                          <span style={styles.recordingDot} />
                          {formatTimer(recordingSeconds)}
                        </div>
                      )}
                      {isRecording ? (
                        <button onClick={stopRecording} style={styles.shutterBtnVideoRecording} title="Stop Recording" />
                      ) : (
                        <button onClick={startRecording} style={styles.shutterBtnVideo} title="Start Recording" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={styles.videoStreamContainer}>
                {capturedType === 'image' ? (
                  <img
                    src={URL.createObjectURL(capturedBlob)}
                    alt="Captured preview"
                    style={styles.cameraStream}
                  />
                ) : (
                  <video
                    src={URL.createObjectURL(capturedBlob)}
                    controls
                    autoPlay
                    loop
                    style={styles.cameraStream}
                  />
                )}

                {/* Captured Form / Caption Input */}
                <div style={styles.capturedControlsCard}>
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="Add a caption..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    style={styles.cameraCaptionInput}
                    autoFocus
                  />
                  <div style={styles.capturedActions}>
                    <button onClick={handleRetake} className="glass-btn" style={styles.retakeBtn}>
                      <FiRotateCcw style={{ marginRight: '5px' }} /> Retake
                    </button>
                    <button onClick={handleSendCaptured} className="glass-btn" style={styles.sendCapturedBtn}>
                      <FiSend style={{ marginRight: '5px' }} /> Send
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
   3. ContactSelectModal
   Search and select list of contacts/users to share contact card
   ============================================================================ */
export const ContactSelectModal = ({ onCancel, onSend }) => {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Fetch initial contacts on mount
  useEffect(() => {
    fetchUsers('');
  }, []);

  const fetchUsers = async (query) => {
    setLoading(true);
    try {
      const response = await api.get(`/users/search?q=${query}`);
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to search users in contact select modal', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    // Debounce/Fetch
    const delay = setTimeout(() => {
      fetchUsers(val.trim());
    }, 300);
    return () => clearTimeout(delay);
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
  };

  const handleConfirmSend = () => {
    if (selectedUser) {
      onSend(selectedUser);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Share Contact</h3>
          <button onClick={onCancel} style={styles.closeBtn}>
            <FiX />
          </button>
        </div>

        {!selectedUser ? (
          <>
            {/* Search */}
            <div style={styles.searchBarWrapper}>
              <FiSearch style={styles.searchIcon} />
              <input
                type="text"
                className="glass-input"
                placeholder="Search contacts..."
                value={search}
                onChange={handleSearchChange}
                style={styles.searchInput}
                autoFocus
              />
            </div>

            {/* List */}
            <div style={styles.contactListWrapper}>
              {loading && <p style={styles.centeredText}>Searching contacts...</p>}
              {!loading && users.length === 0 && <p style={styles.centeredText}>No contacts found</p>}
              
              {!loading && users.map((u) => (
                <div
                  key={u.id}
                  onClick={() => handleUserSelect(u)}
                  style={styles.contactItem}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {u.profile_image ? (
                    <img
                      src={`http://localhost:5000${u.profile_image}`}
                      alt={u.username}
                      style={styles.contactAvatar}
                    />
                  ) : (
                    <div style={styles.contactAvatarText}>
                      {u.username.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div style={styles.contactMeta}>
                    <div style={styles.contactName}>{u.username}</div>
                    <div style={styles.contactBio}>{u.bio || u.custom_status || 'No status'}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={styles.confirmShareWrapper}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem' }}>
              Are you sure you want to share this contact card?
            </p>
            
            {/* Contact Card Preview */}
            <div style={styles.confirmContactCard}>
              {selectedUser.profile_image ? (
                <img
                  src={`http://localhost:5000${selectedUser.profile_image}`}
                  alt={selectedUser.username}
                  style={styles.confirmAvatar}
                />
              ) : (
                <div style={styles.confirmAvatarText}>
                  {selectedUser.username.substring(0, 2).toUpperCase()}
                </div>
              )}
              <h4 style={{ margin: '10px 0 5px 0', fontSize: '1.1rem', fontWeight: 600 }}>
                {selectedUser.username}
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0, textAlign: 'center' }}>
                {selectedUser.bio || selectedUser.custom_status || 'Hello! I am using NovaChat.'}
              </p>
            </div>

            <div style={styles.confirmActions}>
              <button onClick={() => setSelectedUser(null)} className="glass-btn" style={styles.cancelBtn}>
                Back
              </button>
              <button onClick={handleConfirmSend} className="glass-btn" style={styles.sendBtn}>
                Send Contact
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
   Component Inline Styling
   Fits nicely with the NovaChat glassmorphic look
   ============================================================================ */
const styles = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(5, 5, 10, 0.75)',
    backdropFilter: 'blur(10px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'fadeIn 0.2s ease-out'
  },
  modalCard: {
    width: '100%',
    maxWidth: '480px',
    background: 'rgba(20, 20, 30, 0.95)',
    border: '1px solid var(--glass-border)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'zoomIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  modalCardLarge: {
    width: '100%',
    maxWidth: '720px',
    background: 'rgba(20, 20, 30, 0.95)',
    border: '1px solid var(--glass-border)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'zoomIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--glass-border)'
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 600,
    color: 'var(--text-inverse)'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '1.25rem',
    cursor: 'pointer',
    display: 'flex',
    transition: 'color 0.2s ease'
  },
  previewContainer: {
    padding: '20px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'rgba(0, 0, 0, 0.2)',
    minHeight: '260px',
    maxHeight: '400px',
    overflow: 'hidden'
  },
  mediaPreview: {
    maxWidth: '100%',
    maxHeight: '340px',
    borderRadius: '8px',
    objectFit: 'contain'
  },
  audioPreviewWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    width: '100%'
  },
  audioIconCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(124, 110, 230, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--glass-border)'
  },
  audioControls: {
    width: '80%',
    outline: 'none'
  },
  documentPreviewWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '20px'
  },
  docName: {
    fontWeight: 600,
    color: 'var(--text-inverse)',
    fontSize: '1rem',
    marginBottom: '5px',
    maxWidth: '320px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  docSize: {
    color: 'var(--text-muted)',
    fontSize: '0.85rem'
  },
  previewForm: {
    padding: '20px',
    borderTop: '1px solid var(--glass-border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  captionInput: {
    width: '100%',
    padding: '12px 18px'
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  cancelBtn: {
    padding: '8px 18px',
    fontSize: '0.9rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    color: 'var(--text-muted)'
  },
  sendBtn: {
    padding: '8px 18px',
    fontSize: '0.9rem',
    background: 'linear-gradient(135deg, var(--accent-primary) 0%, #6200ea 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center'
  },
  errorContainer: {
    padding: '40px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px'
  },
  errorText: {
    color: 'var(--danger)',
    fontSize: '0.95rem'
  },
  errorCloseBtn: {
    padding: '8px 24px',
    background: 'rgba(255,255,255,0.08)'
  },
  cameraMainBody: {
    padding: '0'
  },
  videoStreamContainer: {
    position: 'relative',
    width: '100%',
    height: '420px',
    background: '#000',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  cameraStream: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  cameraModesOverlay: {
    position: 'absolute',
    top: '15px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '10px',
    background: 'rgba(0,0,0,0.6)',
    padding: '4px 6px',
    borderRadius: '20px',
    backdropFilter: 'blur(5px)',
    border: '1px solid rgba(255,255,255,0.15)'
  },
  modeToggleBtn: {
    border: 'none',
    borderRadius: '16px',
    padding: '6px 14px',
    fontSize: '0.8rem',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease'
  },
  shutterContainer: {
    position: 'absolute',
    bottom: '25px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10
  },
  shutterBtnPhoto: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: '#ffffff',
    border: '5px solid rgba(255, 255, 255, 0.4)',
    cursor: 'pointer',
    outline: 'none',
    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
    transition: 'transform 0.15s ease'
  },
  shutterBtnVideo: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'var(--danger)',
    border: '5px solid rgba(248, 113, 113, 0.4)',
    cursor: 'pointer',
    outline: 'none',
    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
    transition: 'transform 0.15s ease'
  },
  shutterBtnVideoRecording: {
    width: '64px',
    height: '64px',
    borderRadius: '12px',
    background: 'var(--danger)',
    border: '5px solid rgba(248, 113, 113, 0.4)',
    cursor: 'pointer',
    outline: 'none',
    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
    transition: 'transform 0.15s ease'
  },
  recordingTimer: {
    background: 'rgba(0,0,0,0.7)',
    color: '#ffffff',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 600
  },
  recordingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'red',
    display: 'inline-block',
    animation: 'pulse 1s infinite'
  },
  capturedControlsCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    background: 'rgba(10, 10, 15, 0.9)',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  cameraCaptionInput: {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '10px 16px',
    color: '#fff',
    borderRadius: '8px'
  },
  capturedActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px'
  },
  retakeBtn: {
    padding: '8px 16px',
    fontSize: '0.85rem',
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--text-muted)'
  },
  sendCapturedBtn: {
    padding: '8px 16px',
    fontSize: '0.85rem',
    background: 'linear-gradient(135deg, var(--accent-primary) 0%, #6200ea 100%)',
    color: '#fff',
    border: 'none'
  },
  searchBarWrapper: {
    padding: '15px 20px',
    position: 'relative',
    borderBottom: '1px solid var(--glass-border)'
  },
  searchIcon: {
    position: 'absolute',
    left: '32px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    fontSize: '1rem'
  },
  searchInput: {
    width: '100%',
    paddingLeft: '38px',
    paddingTop: '8px',
    paddingBottom: '8px',
    fontSize: '0.9rem'
  },
  contactListWrapper: {
    flex: 1,
    overflowY: 'auto',
    maxHeight: '320px',
    padding: '10px'
  },
  contactItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  contactAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover'
  },
  contactAvatarText: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    color: 'var(--text-main)',
    fontSize: '0.9rem',
    border: '1px solid var(--glass-border)'
  },
  contactMeta: {
    flex: 1,
    minWidth: 0
  },
  contactName: {
    fontWeight: 600,
    fontSize: '0.92rem',
    color: 'var(--text-main)'
  },
  contactBio: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  centeredText: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    padding: '20px'
  },
  confirmShareWrapper: {
    padding: '30px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  confirmContactCard: {
    width: '100%',
    maxWidth: '240px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '25px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
  },
  confirmAvatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid var(--accent-primary)'
  },
  confirmAvatarText: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    color: 'var(--text-main)',
    fontSize: '1.25rem',
    border: '2px solid var(--accent-primary)'
  },
  confirmActions: {
    display: 'flex',
    gap: '15px',
    width: '100%',
    justifyContent: 'center'
  }
};
