import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import GlassCard from '../common/GlassCard';
import { FiKey, FiMail, FiLock, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

const ResetPassword = ({ token: initialToken, onNavigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState(initialToken || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Check URL query parameters for reset token if not explicitly provided as a prop
  useEffect(() => {
    if (!token) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      if (urlToken) {
        setToken(urlToken);
      }
    }
  }, [token]);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/auth/reset-password-request', { email: email.trim() });
      setSuccess('If the email exists, a password reset link has been dispatched to terminal logs.');
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request reset link.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteReset = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess('Password has been reset successfully! Redirecting to login...');
      setTimeout(() => {
        // Clear query param and navigate
        window.history.replaceState({}, document.title, window.location.pathname);
        onNavigate('login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired reset token.');
    } finally {
      setLoading(false);
    }
  };

  const isResetting = !!token;

  return (
    <div className="glass-container">
      <GlassCard style={{ width: '100%', maxWidth: '420px', padding: '48px 36px' }}>
        {/* Brand Logo & Heading */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            color: '#ffffff',
            margin: '0 auto 16px auto',
            boxShadow: '0 8px 24px rgba(124, 58, 237, 0.3)',
          }}>
            <FiKey />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px' }}>
            {isResetting ? 'Reset Password' : 'Forgot Password'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
            {isResetting ? 'Choose a secure new password' : 'Enter email to receive a secure link'}
          </p>
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

        {isResetting ? (
          <form onSubmit={handleExecuteReset}>
            <div className="glass-input-group">
              <label className="glass-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="glass-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  style={{ paddingLeft: '44px' }}
                  required
                />
                <FiLock style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontSize: '1.1rem'
                }} />
              </div>
            </div>

            <div className="glass-input-group" style={{ marginBottom: '28px' }}>
              <label className="glass-label">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="glass-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  style={{ paddingLeft: '44px' }}
                  required
                />
                <FiLock style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontSize: '1.1rem'
                }} />
              </div>
            </div>

            <button
              type="submit"
              className="glass-btn"
              style={{ width: '100%', marginBottom: '24px', height: '46px' }}
              disabled={loading}
            >
              {loading ? 'Updating Password...' : 'Reset Password'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestReset}>
            <div className="glass-input-group" style={{ marginBottom: '28px' }}>
              <label className="glass-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="glass-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email associated with account"
                  style={{ paddingLeft: '44px' }}
                  required
                />
                <FiMail style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontSize: '1.1rem'
                }} />
              </div>
            </div>

            <button
              type="submit"
              className="glass-btn"
              style={{ width: '100%', marginBottom: '24px', height: '46px' }}
              disabled={loading}
            >
              {loading ? 'Sending Link...' : 'Request Reset Link'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              // Clear query param
              window.history.replaceState({}, document.title, window.location.pathname);
              onNavigate('login');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.9rem',
              transition: 'var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            Back to Login
          </button>
        </div>
      </GlassCard>
    </div>
  );
};

export default ResetPassword;
