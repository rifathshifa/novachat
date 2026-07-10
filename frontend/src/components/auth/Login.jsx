import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import GlassCard from '../common/GlassCard';

const Login = ({ onNavigate, onToggleReset }) => {
  const { login } = useContext(AuthContext);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!loginId.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);
    const result = await login(loginId, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
    }
  };

  return (
    <div className="glass-container">
      <GlassCard style={{ width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '10px', fontSize: '1.8rem', fontWeight: 700 }}>
          NovaChat
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '25px', fontSize: '0.95rem' }}>
          Secure Enterprise Messenger
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
            lineHeight: '1.4'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="glass-input-group">
            <label className="glass-label">Username or Email</label>
            <input
              type="text"
              className="glass-input"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="Enter email or username"
              required
            />
          </div>

          <div className="glass-input-group" style={{ marginBottom: '10px' }}>
            <label className="glass-label">Password</label>
            <input
              type="password"
              className="glass-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          <div style={{ textAlign: 'right', marginBottom: '25px' }}>
            <button
              type="button"
              onClick={onToggleReset}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-secondary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Forgot Password?
            </button>
          </div>

          <button type="submit" className="glass-btn" style={{ width: '100%', marginBottom: '20px' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => onNavigate('register')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-primary)',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Sign Up
          </button>
        </p>
      </GlassCard>
    </div>
  );
};

export default Login;
