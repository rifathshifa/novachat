import React, { useState, useContext, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import GlassCard from '../common/GlassCard';
import { FiCamera, FiX } from 'react-icons/fi';

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
    (user?.profile_image ? `http://localhost:5000${user.profile_image}` : null);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 500,
    }}>
      <GlassCard style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '1.25rem'
          }}
        >
          <FiX />
        </button>

        <h2 style={{ textAlign: 'center', marginBottom: '25px', fontSize: '1.4rem', fontWeight: 700 }}>
          Profile Settings
        </h2>

        {/* Avatar Section */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '25px' }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
            {currentImage ? (
              <img
                src={currentImage}
                alt="Profile"
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--accent-primary)',
                }}
              />
            ) : (
              <div style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, #00e5ff 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '2rem',
                color: '#fff',
              }}>
                {user?.username?.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              background: 'var(--accent-primary)',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #0d0d1e',
            }}>
              <FiCamera style={{ fontSize: '0.8rem', color: '#fff' }} />
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
            background: 'rgba(255, 23, 68, 0.1)',
            border: '1px solid var(--danger)',
            color: '#ff8a80',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            marginBottom: '20px',
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: 'rgba(0, 230, 118, 0.1)',
            border: '1px solid var(--success)',
            color: '#b9f6ca',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            marginBottom: '20px',
          }}>
            {success}
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
              style={{ resize: 'vertical', minHeight: '70px' }}
            />
          </div>

          <div className="glass-input-group" style={{ marginBottom: '25px' }}>
            <label className="glass-label">Custom Status</label>
            <input
              type="text"
              className="glass-input"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              placeholder="What are you up to?"
              maxLength={100}
            />
          </div>

          <button type="submit" className="glass-btn" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </GlassCard>
    </div>
  );
};

export default ProfileSettings;
