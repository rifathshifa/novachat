import React, { useState, useEffect, useContext, useRef } from 'react';
import { SocketContext } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';
import { useChat } from '../../hooks/useChat';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import api from '../../services/api';
import { FiPhone, FiVideo, FiShield, FiAlertCircle, FiMessageSquare } from 'react-icons/fi';

// Media base URL (backend origin) — set VITE_UPLOADS_URL in .env
const UPLOADS_URL = import.meta.env.VITE_UPLOADS_URL || 'http://localhost:5000';

const ChatContainer = ({ activeContact, onStartCall }) => {
  const { user } = useContext(AuthContext);
  const { onlineUsers, typingUsers } = useContext(SocketContext);
  
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedBy, setIsBlockedBy] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [uploadError, setUploadError] = useState('');

  const chatContainerRef = useRef(null);

  const {
    messages,
    loadingHistory,
    sendError,
    loadMoreMessages,
    sendTextMessage,
    sendAttachmentMessage,
    deleteMessage,
    editMessage,
    togglePinMessage,
    messagesEndRef,
  } = useChat(activeContact);

  // Sync block status of active contact
  useEffect(() => {
    if (!activeContact) return;
    
    // Check block relationship status
    setIsBlocked(activeContact.is_blocked || false);
    setIsBlockedBy(activeContact.is_blocked_by || false);
    setReplyTo(null);
    setUploadError('');
  }, [activeContact]);

  const handleBlockToggle = async () => {
    if (!activeContact) return;
    
    try {
      if (isBlocked) {
        await api.post('/users/unblock', { user_id: activeContact.id });
        setIsBlocked(false);
        activeContact.is_blocked = false; // Sync locally
      } else {
        await api.post('/users/block', { user_id: activeContact.id });
        setIsBlocked(true);
        activeContact.is_blocked = true; // Sync locally
      }
    } catch (err) {
      console.error('Failed to toggle block status', err);
    }
  };

  const handleScroll = (e) => {
    if (e.currentTarget.scrollTop === 0) {
      loadMoreMessages();
    }
  };

  const handleSendAttachment = async (file) => {
    setUploadError('');
    const result = await sendAttachmentMessage(file);
    if (!result.success) {
      setUploadError(result.error);
    }
  };

  if (!activeContact) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        background: 'var(--bg-chat)',
        position: 'relative'
      }}>
        <div className="chat-bg-pattern" />
        <div style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          padding: '40px',
          maxWidth: '440px',
          animation: 'scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'var(--primary-light)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            color: 'var(--primary)',
            margin: '0 auto 20px auto',
            boxShadow: '0 8px 24px rgba(124, 58, 237, 0.1)'
          }}>
            <FiMessageSquare />
          </div>
          <h3 style={{ marginBottom: '12px', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Welcome to NovaChat
          </h3>
          <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Select a contact from the sidebar or search for users to begin secure, real-time end-to-end messaging.
          </p>
        </div>
      </div>
    );
  }

  const isContactOnline = onlineUsers.has(activeContact.id) || activeContact.status === 'Online';
  const isTyping = typingUsers[activeContact.id] || false;

  return (
    <div className="chat-main animate-fade-in">
      {/* Background wallpaper pattern */}
      <div className="chat-bg-pattern" />

      {/* Header section */}
      <div className="chat-window-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {activeContact.profile_image ? (
            <img
              src={`${UPLOADS_URL}${activeContact.profile_image}`}
              alt={activeContact.username}
              style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div className="avatar-initials" style={{ width: '42px', height: '42px', fontSize: '0.95rem' }}>
              {activeContact.username.substring(0, 2).toUpperCase()}
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 700, fontSize: '0.975rem', color: 'var(--text-primary)' }}>
              {activeContact.username}
            </span>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 500,
              color: isTyping ? 'var(--primary)' : (isContactOnline ? 'var(--success)' : 'var(--text-muted)')
            }}>
              {isTyping ? 'typing...' : (isContactOnline ? 'Online' : 'Offline')}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Peer-to-Peer Calling buttons (WebRTC limited to unblocked states) */}
          {!isBlocked && !isBlockedBy && (
            <>
              <button
                onClick={() => onStartCall('audio')}
                className="circle-btn"
                title="Voice Call"
              >
                <FiPhone />
              </button>
              <button
                onClick={() => onStartCall('video')}
                className="circle-btn"
                title="Video Call"
              >
                <FiVideo />
              </button>
            </>
          )}

          {/* Block moderation control */}
          <button
            onClick={handleBlockToggle}
            className={`circle-btn danger-action`}
            style={isBlocked ? {
              background: 'rgba(239, 68, 68, 0.15)',
              borderColor: 'var(--danger)',
              color: 'var(--danger)'
            } : {}}
            title={isBlocked ? 'Unblock Contact' : 'Block Contact'}
          >
            <FiShield />
          </button>
        </div>
      </div>

      {/* Message Stream */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 30px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1
        }}
      >
        {loadingHistory && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '20px', fontWeight: 500 }}>
            Loading message history...
          </p>
        )}
        
        {messages.length === 0 ? (
          <div style={{
            margin: 'auto',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            background: 'rgba(255,255,255,0.6)',
            padding: '12px 24px',
            borderRadius: '20px',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-soft)',
            fontWeight: 500
          }}>
            No messages. Start a secure conversation.
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMe={msg.sender_id === user.id}
              onReply={(m) => setReplyTo(m)}
              onDelete={deleteMessage}
              onEdit={editMessage}
              onPin={togglePinMessage}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error displays */}
      {(uploadError || sendError) && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          borderTop: '1px solid rgba(239, 68, 68, 0.15)',
          color: 'var(--danger)',
          padding: '12px 30px',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          position: 'relative',
          zIndex: 1,
          fontWeight: 500
        }}>
          <FiAlertCircle /> <span>{uploadError || sendError}</span>
        </div>
      )}

      {/* Composition composer section */}
      {isBlocked ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          background: 'rgba(239, 68, 68, 0.08)',
          color: 'var(--danger)',
          fontSize: '0.875rem',
          fontWeight: 600,
          borderTop: '1px solid rgba(239, 68, 68, 0.15)',
          position: 'relative',
          zIndex: 1
        }}>
          You have blocked this contact. Unblock to resume messaging.
        </div>
      ) : isBlockedBy ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          background: 'rgba(239, 68, 68, 0.08)',
          color: 'var(--danger)',
          fontSize: '0.875rem',
          fontWeight: 600,
          borderTop: '1px solid rgba(239, 68, 68, 0.15)',
          position: 'relative',
          zIndex: 1
        }}>
          You cannot send messages to this contact. Block active.
        </div>
      ) : (
        <MessageInput
          recipientId={activeContact.id}
          onSendText={sendTextMessage}
          onSendAttachment={handleSendAttachment}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      )}
    </div>
  );
};

export default ChatContainer;
