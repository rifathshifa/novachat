import React, { useState, useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ResetPassword from './components/auth/ResetPassword';
import ChatList from './components/chat/ChatList';
import ChatContainer from './components/chat/ChatContainer';
import ProfileSettings from './components/chat/ProfileSettings';
import CallWindow from './components/calling/CallWindow';
import IncomingCallModal from './components/calling/IncomingCallModal';
import { useWebRTC } from './hooks/useWebRTC';

const App = () => {
  const { user, loading } = useContext(AuthContext);
  const [authView, setAuthView] = useState('login'); // login, register, reset
  const [activeContact, setActiveContact] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const {
    callState,
    mediaType,
    isMuted,
    isCameraOff,
    callDuration,
    localVideoRef,
    remoteVideoRef,
    incomingCall,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useWebRTC(activeContact);

  // Loading spinner while checking auth state
  if (loading) {
    return (
      <div className="glass-container">
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--glass-border)',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 15px auto',
          }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading NovaChat...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // UNAUTHENTICATED: Show auth views
  if (!user) {
    if (authView === 'register') {
      return <Register onNavigate={setAuthView} />;
    }
    if (authView === 'reset') {
      return <ResetPassword onNavigate={setAuthView} />;
    }
    return (
      <Login
        onNavigate={setAuthView}
        onToggleReset={() => setAuthView('reset')}
      />
    );
  }

  // AUTHENTICATED: Main chat workspace
  return (
    <>
      <div className="chat-app-container">
        <ChatList
          activeContact={activeContact}
          onSelectContact={setActiveContact}
          onOpenSettings={() => setShowSettings(true)}
        />
        <ChatContainer
          activeContact={activeContact}
          onStartCall={(type) => startCall(type)}
        />
      </div>

      {/* Profile Settings Modal */}
      {showSettings && (
        <ProfileSettings onClose={() => setShowSettings(false)} />
      )}

      {/* Incoming Call Modal */}
      {callState === 'incoming' && incomingCall && (
        <IncomingCallModal
          callerName={incomingCall.caller?.username}
          mediaType={incomingCall.media_type}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}

      {/* Active Call Window (outgoing, connecting, connected) */}
      {(callState === 'outgoing' || callState === 'connecting' || callState === 'connected') && (
        <CallWindow
          callState={callState}
          mediaType={mediaType}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          callDuration={callDuration}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          onEndCall={endCall}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          contactName={activeContact?.username}
        />
      )}
    </>
  );
};

export default App;
