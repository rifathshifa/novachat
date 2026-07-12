import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import GlassCard from '../common/GlassCard';
import { FiMessageSquare, FiUserPlus, FiUser, FiMail, FiLock, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

const Register = ({ onNavigate }) => {
  const { register } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
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
    const result = await register(username.trim(), email.trim(), password);
    setLoading(false);

    if (result.success) {
      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        onNavigate('login');
      }, 2000);
    } else {
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
            <FiUserPlus />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px' }}>
            Create Account
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
            Join NovaChat secure messenger
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

        <form onSubmit={handleSubmit}>
          <div className="glass-input-group">
            <label className="glass-label">Username</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="glass-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
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

          <div className="glass-input-group">
            <label className="glass-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                className="glass-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
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

          <div className="glass-input-group">
            <label className="glass-label">Password</label>
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
            <label className="glass-label">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="glass-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
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
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onNavigate('login')}
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
            Sign In
          </button>
        </p>
      </GlassCard>
    </div>
  );
};

export default Register;
