import React, { useState, useEffect, useContext, useRef } from 'react';
import { SocketContext } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';
import { useChat } from '../../hooks/useChat';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import api from '../../services/api';
import { FiPhone, FiVideo, FiShield, FiAlertCircle } from 'react-icons/fi';

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
        background: 'rgba(255, 255, 255, 0.01)',
        backdropFilter: 'blur(10px)'
      }}>
        <h3 style={{ marginBottom: '10px', fontSize: '1.4rem' }}>Welcome to NovaChat</h3>
        <p style={{ fontSize: '0.95rem' }}>Select a contact or search for users to begin secure messaging.</p>
      </div>
    );
  }

  const isContactOnline = onlineUsers.has(activeContact.id) || activeContact.status === 'Online';
  const isTyping = typingUsers[activeContact.id] || false;

  return (
    <div className="chat-main animate-fade-in">
      {/* Header section */}
      <div style={{
        padding: '15px 30px',
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(10, 10, 20, 0.45)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {activeContact.profile_image ? (
            <img
              src={`http://localhost:5000${activeContact.profile_image}`}
              alt={activeContact.username}
              style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600
            }}>
              {activeContact.username.substring(0, 2).toUpperCase()}
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, fontSize: '1rem' }}>{activeContact.username}</span>
            <span style={{ fontSize: '0.78rem', color: isContactOnline ? 'var(--success)' : 'var(--text-muted)' }}>
              {isTyping ? 'typing...' : (isContactOnline ? 'Online' : 'Offline')}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Peer-to-Peer Calling buttons (WebRTC limited to unblocked states) */}
          {!isBlocked && !isBlockedBy && (
            <>
              <button
                onClick={() => onStartCall('audio')}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                title="Voice Call"
              >
                <FiPhone />
              </button>
              <button
                onClick={() => onStartCall('video')}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                title="Video Call"
              >
                <FiVideo />
              </button>
            </>
          )}

          {/* Block moderation control */}
          <button
            onClick={handleBlockToggle}
            style={{
              background: isBlocked ? 'rgba(255, 23, 68, 0.15)' : 'rgba(255,255,255,0.05)',
              border: isBlocked ? '1px solid var(--danger)' : '1px solid var(--glass-border)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: isBlocked ? 'var(--danger)' : 'var(--text-muted)',
              transition: 'all 0.2s ease'
            }}
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
          padding: '20px 30px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {loadingHistory && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '15px' }}>
            Loading message history...
          </p>
        )}
        
        {messages.length === 0 ? (
          <div style={{
            margin: 'auto',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.9rem'
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
      {uploadError && (
        <div style={{
          background: 'rgba(255, 23, 68, 0.15)',
          color: '#ff8a80',
          padding: '10px 30px',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <FiAlertCircle /> {uploadError}
        </div>
      )}

      {/* Composition composer section */}
      {isBlocked ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          background: 'rgba(255, 23, 68, 0.08)',
          color: '#ff8a80',
          fontSize: '0.9rem',
          borderTop: '1px solid rgba(255, 23, 68, 0.2)'
        }}>
          You have blocked this contact. Unblock to resume messaging.
        </div>
      ) : isBlockedBy ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          background: 'rgba(255, 23, 68, 0.08)',
          color: '#ff8a80',
          fontSize: '0.9rem',
          borderTop: '1px solid rgba(255, 23, 68, 0.2)'
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
