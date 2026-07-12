import React, { useState, useContext, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import GlassCard from '../common/GlassCard';
import { FiCamera, FiX, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

// Media base URL (backend origin) — set VITE_UPLOADS_URL in .env
const UPLOADS_URL = import.meta.env.VITE_UPLOADS_URL || 'http://localhost:5000';

const ProfileSettings = ({ onClose }) => {
  const { user, updateProfile } = useContext(AuthContext);
  const [bio, setBio] = useState(user?.bio || '');
  const [customStatus, setCustomStatus] = useState(user?.custom_status || '');
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation: PNG/JPG only, < 5MB
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Only PNG and JPG images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be under 5MB.');
      return;
    }

    setError('');
    setSelectedFile(file);
    setPreviewImage(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const formData = new FormData();
    formData.append('bio', bio);
    formData.append('custom_status', customStatus);
    if (selectedFile) {
      formData.append('profile_image', selectedFile);
    }

    const result = await updateProfile(formData);
    setLoading(false);

    if (result.success) {
      setSuccess('Profile updated successfully!');
      setSelectedFile(null);
      setTimeout(() => onClose(), 1500);
    } else {
      setError(result.error);
    }
  };

  const currentImage = previewImage ||
    (user?.profile_image ? `${UPLOADS_URL}${user.profile_image}` : null);

  return (
    <div className="modal-overlay-custom">
      <GlassCard style={{ width: '100%', maxWidth: '420px', position: 'relative', padding: '40px 32px' }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="circle-btn"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none'
          }}
          title="Close Settings"
        >
          <FiX />
        </button>

        <h2 style={{ textAlign: 'center', marginBottom: '28px', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
          Profile Settings
        </h2>

        {/* Avatar Section */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <div className="avatar-upload-trigger" onClick={() => fileRef.current?.click()} style={{ width: '96px', height: '96px', boxShadow: 'var(--shadow-md)' }}>
            {currentImage ? (
              <img
                src={currentImage}
                alt="Profile"
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--primary)',
                }}
              />
            ) : (
              <div className="avatar-initials" style={{ width: '96px', height: '96px', fontSize: '2rem' }}>
                {user?.username?.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="avatar-upload-hover">
              <FiCamera style={{ fontSize: '1.4rem' }} />
            </div>
          </div>
          <input
            type="file"
            ref={fileRef}
            onChange={handleFileSelect}
            accept="image/png,image/jpeg"
            style={{ display: 'none' }}
          />
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--danger)',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '0.875rem',
            marginBottom: '24px',
            lineHeight: '1.45',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <FiAlertCircle style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            color: 'var(--success)',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '0.875rem',
            marginBottom: '24px',
            lineHeight: '1.45',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <FiCheckCircle style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="glass-input-group">
            <label className="glass-label">Bio</label>
            <textarea
              className="glass-input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about yourself..."
              maxLength={256}
              style={{ resize: 'vertical', minHeight: '80px', borderRadius: '14px' }}
            />
          </div>

          <div className="glass-input-group" style={{ marginBottom: '32px' }}>
            <label className="glass-label">Custom Status</label>
            <input
              type="text"
              className="glass-input"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              placeholder="What are you up to?"
              maxLength={100}
              style={{ borderRadius: '14px' }}
            />
          </div>

          <button type="submit" className="glass-btn" style={{ width: '100%', height: '46px' }} disabled={loading}>
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </GlassCard>
    </div>
  );
};

export default ProfileSettings;
