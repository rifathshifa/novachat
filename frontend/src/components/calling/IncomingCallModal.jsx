import React from 'react';
import GlassCard from '../common/GlassCard';
import { FiPhone, FiVideo, FiX } from 'react-icons/fi';

const IncomingCallModal = ({ callerName, mediaType, onAccept, onReject }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(15px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
    }}>
      <GlassCard style={{ width: '100%', maxWidth: '340px', textAlign: 'center', padding: '40px 30px' }}>
        {/* Caller Avatar Placeholder */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-primary) 0%, #00e5ff 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '1.8rem',
          color: '#fff',
          margin: '0 auto 20px auto',
          animation: 'pulse 2s infinite',
        }}>
          {callerName?.substring(0, 2).toUpperCase() || '??'}
        </div>

        <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' }}>
          {callerName || 'Unknown'}
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '30px' }}>
          Incoming {mediaType === 'video' ? 'Video' : 'Voice'} Call...
        </p>

        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          {/* Reject */}
          <button
            onClick={onReject}
            style={{
              width: '56px', height: '56px',
              borderRadius: '50%',
              background: 'var(--danger)',
              border: 'none',
              color: '#fff',
              fontSize: '1.3rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(255, 23, 68, 0.4)',
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <FiX />
          </button>

          {/* Accept */}
          <button
            onClick={onAccept}
            style={{
              width: '56px', height: '56px',
              borderRadius: '50%',
              background: 'var(--success)',
              border: 'none',
              color: '#fff',
              fontSize: '1.3rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(0, 230, 118, 0.4)',
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {mediaType === 'video' ? <FiVideo /> : <FiPhone />}
          </button>
        </div>
      </GlassCard>
    </div>
  );
};

export default IncomingCallModal;
