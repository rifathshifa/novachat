import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import GlassCard from '../common/GlassCard';

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
      <GlassCard style={{ width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '10px', fontSize: '1.8rem', fontWeight: 700 }}>
          {isResetting ? 'Reset Password' : 'Forgot Password'}
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '25px', fontSize: '0.95rem' }}>
          {isResetting ? 'Choose a secure new password' : 'Enter email to receive a secure link'}
        </p>

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

        {isResetting ? (
          <form onSubmit={handleExecuteReset}>
            <div className="glass-input-group">
              <label className="glass-label">New Password</label>
              <input
                type="password"
                className="glass-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
              />
            </div>

            <div className="glass-input-group" style={{ marginBottom: '25px' }}>
              <label className="glass-label">Confirm New Password</label>
              <input
                type="password"
                className="glass-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
            </div>

            <button type="submit" className="glass-btn" style={{ width: '100%', marginBottom: '20px' }} disabled={loading}>
              {loading ? 'Updating Password...' : 'Reset Password'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestReset}>
            <div className="glass-input-group" style={{ marginBottom: '25px' }}>
              <label className="glass-label">Email Address</label>
              <input
                type="email"
                className="glass-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email associated with account"
                required
              />
            </div>

            <button type="submit" className="glass-btn" style={{ width: '100%', marginBottom: '20px' }} disabled={loading}>
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
              color: 'var(--accent-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            Back to Login
          </button>
        </div>
      </GlassCard>
    </div>
  );
};

export default ResetPassword;
