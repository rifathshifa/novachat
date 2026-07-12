import React, { useState, useRef, useEffect, useContext } from 'react';
import { SocketContext } from '../../context/SocketContext';
import { FiPaperclip, FiSend, FiX, FiSmile, FiMic } from 'react-icons/fi';
import VoiceRecorder from './VoiceRecorder';

const MessageInput = ({ recipientId, onSendText, onSendAttachment, replyTo, onCancelReply }) => {
  const { socket } = useContext(SocketContext);
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // Clean up typing status when recipient changes
  useEffect(() => {
    if (isTyping && socket) {
      socket.emit('typing_stop', { recipient_id: recipientId });
      setIsTyping(false);
    }
    setText('');
    setIsRecordingMode(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [recipientId]);

  const handleChange = (e) => {
    setText(e.target.value);
    
    if (!socket || !recipientId) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing_start', { recipient_id: recipientId });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing_stop', { recipient_id: recipientId });
    }, 1500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    onSendText(text.trim(), replyTo?.id);
    setText('');
    
    // Explicitly send typing_stop on submission
    if (socket && recipientId) {
      socket.emit('typing_stop', { recipient_id: recipientId });
      setIsTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
    
    if (replyTo) {
      onCancelReply();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendAttachment(file);
      e.target.value = ''; // reset file input
    }
  };

  return (
    <div className="composition-area">
      {/* Reply Reference Preview Banner */}
      {replyTo && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(124, 58, 237, 0.08)',
          borderLeft: '4px solid var(--primary)',
          padding: '10px 16px',
          borderRadius: '8px',
          fontSize: '0.85rem',
          animation: 'slideUp 0.25s ease'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
              Replying to Message
            </span>
            <span style={{
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '500px',
              fontWeight: 500
            }}>
              {replyTo.content_type === 'text' ? replyTo.content : `[${replyTo.content_type} file]`}
            </span>
          </div>
          <button
            onClick={onCancelReply}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}
          >
            <FiX style={{ fontSize: '1.1rem' }} />
          </button>
        </div>
      )}

      {/* Main Input Form controls */}
      {isRecordingMode ? (
        <VoiceRecorder
          onSend={(file) => {
            onSendAttachment(file);
            setIsRecordingMode(false);
          }}
          onCancel={() => setIsRecordingMode(false)}
        />
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="circle-btn"
            title="Attach File"
          >
            <FiPaperclip style={{ fontSize: '1.2rem' }} />
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <textarea
            className="glass-input glass-input-capsule"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyPress}
            placeholder="Type a secure message..."
            style={{
              flex: 1,
              resize: 'none',
              height: '42px',
              padding: '10px 20px',
              lineHeight: '20px',
              overflow: 'hidden'
            }}
          />

          {text.trim() ? (
            <button
              type="submit"
              className="circle-btn circle-btn-solid"
              style={{ width: '42px', height: '42px', padding: 0 }}
            >
              <FiSend style={{ fontSize: '1.05rem' }} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsRecordingMode(true)}
              className="circle-btn"
              title="Record Voice Message"
            >
              <FiMic style={{ fontSize: '1.1rem' }} />
            </button>
          )}
        </form>
      )}
    </div>
  );
};

export default MessageInput;
