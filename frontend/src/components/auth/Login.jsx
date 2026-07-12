import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import GlassCard from '../common/GlassCard';
import { FiMessageSquare, FiLock, FiUser, FiAlertCircle } from 'react-icons/fi';

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
            <FiMessageSquare />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px' }}>
            NovaChat
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
            Secure Real-time Enterprise Messenger
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

        <form onSubmit={handleSubmit}>
          <div className="glass-input-group">
            <label className="glass-label">Username or Email</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="glass-input"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Enter email or username"
                style={{ paddingLeft: '44px' }}
                required
              />
              <FiUser style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                fontSize: '1.1rem'
              }} />
            </div>
          </div>

          <div className="glass-input-group" style={{ marginBottom: '12px' }}>
            <label className="glass-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="glass-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
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

          <div style={{ textAlign: 'right', marginBottom: '28px' }}>
            <button
              type="button"
              onClick={onToggleReset}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--primary)'}
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            className="glass-btn"
            style={{ width: '100%', marginBottom: '24px', height: '46px' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => onNavigate('register')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontWeight: 700,
              marginLeft: '4px',
              transition: 'var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            Sign Up
          </button>
        </p>
      </GlassCard>
    </div>
  );
};

export default Login;
