import React from 'react';
import GlassCard from '../common/GlassCard';
import { FiPhone, FiVideo, FiX } from 'react-icons/fi';

const IncomingCallModal = ({ callerName, mediaType, onAccept, onReject }) => {
  return (
    <div className="modal-overlay-custom" style={{ zIndex: 1100 }}>
      <GlassCard style={{ width: '100%', maxWidth: '360px', textAlign: 'center', padding: '40px 30px' }}>
        {/* Caller Avatar Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '1.8rem',
          color: '#ffffff',
          margin: '0 auto 20px auto',
          boxShadow: '0 8px 24px var(--primary-glow)',
          animation: 'pulseRing 2s infinite',
        }}>
          {callerName?.substring(0, 2).toUpperCase() || '??'}
        </div>

        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>
          {callerName || 'Unknown'}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginBottom: '32px', fontWeight: 500 }}>
          Incoming {mediaType === 'video' ? 'Video' : 'Voice'} Call...
        </p>

        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          {/* Reject */}
          <button
            onClick={onReject}
            className="circle-btn"
            style={{
              width: '56px',
              height: '56px',
              background: 'var(--danger)',
              border: 'none',
              color: '#ffffff',
              fontSize: '1.4rem',
              boxShadow: '0 4px 16px rgba(239, 68, 68, 0.35)'
            }}
            title="Reject Call"
          >
            <FiX />
          </button>

          {/* Accept */}
          <button
            onClick={onAccept}
            className="circle-btn"
            style={{
              width: '56px',
              height: '56px',
              background: 'var(--success)',
              border: 'none',
              color: '#ffffff',
              fontSize: '1.4rem',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)'
            }}
            title="Accept Call"
          >
            {mediaType === 'video' ? <FiVideo /> : <FiPhone />}
          </button>
        </div>
      </GlassCard>
    </div>
  );
};

export default IncomingCallModal;
