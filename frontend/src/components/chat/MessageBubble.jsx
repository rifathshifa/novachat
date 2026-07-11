import React, { useState } from 'react';
import { FiCheck, FiCornerUpLeft, FiEdit2, FiTrash2, FiMapPin, FiDownload, FiFileText } from 'react-icons/fi';
import VoiceMessagePlayer from './VoiceMessagePlayer';

const MessageBubble = ({ message, isMe, onReply, onDelete, onEdit, onPin }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [showMenu, setShowMenu] = useState(false);

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (editText.trim() && editText.trim() !== message.content) {
      onEdit(message.id, editText.trim());
    }
    setIsEditing(false);
  };

  // Format message timestamp
  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  // Render Checkmark receipts
  const renderStatus = () => {
    if (!isMe || message.is_deleted) return null;
    
    if (message.status === 'read') {
      return (
        <span style={{ display: 'flex', color: 'var(--accent-secondary)' }} title="Read">
          <FiCheck style={{ marginRight: '-6px' }} /><FiCheck />
        </span>
      );
    } else if (message.status === 'delivered') {
      return (
        <span style={{ display: 'flex', color: 'var(--text-muted)' }} title="Delivered">
          <FiCheck style={{ marginRight: '-6px' }} /><FiCheck />
        </span>
      );
    } else {
      return (
        <span style={{ color: 'var(--text-muted)' }} title="Sent">
          <FiCheck />
        </span>
      );
    }
  };

  // Render Attachment elements safely
  const renderAttachment = () => {
    if (message.is_deleted) return null;
    
    const backendUrl = 'http://localhost:5000';
    const fileUrl = `${backendUrl}${message.content}`;

    switch (message.content_type) {
      case 'image':
        return (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={fileUrl}
              alt="Attachment"
              style={{
                maxWidth: '100%',
                maxHeight: '200px',
                borderRadius: '8px',
                marginTop: '5px',
                display: 'block',
                cursor: 'pointer'
              }}
            />
          </a>
        );
      case 'video':
        return (
          <video
            src={fileUrl}
            controls
            style={{
              maxWidth: '100%',
              maxHeight: '200px',
              borderRadius: '8px',
              marginTop: '5px',
              display: 'block'
            }}
          />
        );
      case 'audio':
        return (
          <VoiceMessagePlayer src={fileUrl} isMe={isMe} />
        );
      case 'file':
        const name = message.content.split('/').pop() || 'File';
        return (
          <a
            href={fileUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '8px',
              color: 'var(--text-main)',
              textDecoration: 'none',
              marginTop: '5px',
              fontSize: '0.9rem',
              border: '1px solid rgba(255,255,255,0.05)'
            }}
          >
            <FiFileText style={{ fontSize: '1.2rem', color: 'var(--accent-secondary)' }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name.substring(32)} {/* Strip UUID prefix */}
            </span>
            <FiDownload />
          </a>
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isMe ? 'flex-end' : 'flex-start',
        marginBottom: '14px',
        width: '100%',
        position: 'relative'
      }}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => {
        setShowMenu(false);
        setIsEditing(false);
      }}
    >
      <div
        style={{
          maxWidth: '65%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isMe ? 'flex-end' : 'flex-start',
          gap: '4px'
        }}
      >
        {/* Pinned label indicator */}
        {message.is_pinned && !message.is_deleted && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--accent-secondary)', marginBottom: '2px' }}>
            <FiMapPin /> Pinned
          </div>
        )}

        {/* Message Bubble Card */}
        <div
          style={{
            background: isMe ? 'linear-gradient(135deg, var(--accent-primary) 0%, #6200ea 100%)' : 'rgba(255, 255, 255, 0.05)',
            border: isMe ? 'none' : '1px solid var(--glass-border)',
            padding: message.content_type === 'text' ? '10px 16px' : '6px',
            borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            color: 'var(--text-main)',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
            position: 'relative'
          }}
        >
          {isEditing ? (
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="glass-input"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.9rem', width: '200px' }}
                autoFocus
              />
              <button type="submit" className="glass-btn" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                Save
              </button>
            </form>
          ) : (
            <>
              {/* Text content or media attachment */}
              {message.is_deleted || message.content_type === 'text' ? (
                <p style={{
                  fontSize: '0.95rem',
                  lineHeight: '1.45',
                  wordBreak: 'break-word',
                  fontStyle: message.is_deleted ? 'italic' : 'normal',
                  color: message.is_deleted ? 'var(--text-muted)' : 'var(--text-main)'
                }}>
                  {message.content}
                </p>
              ) : (
                renderAttachment()
              )}
            </>
          )}

          {/* Time & Receipt status bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '5px',
            marginTop: '4px',
            fontSize: '0.72rem',
            color: isMe ? 'rgba(255, 255, 255, 0.65)' : 'var(--text-muted)'
          }}>
            <span>{formatTime(message.created_at)}</span>
            {renderStatus()}
          </div>
        </div>
      </div>

      {/* Hover action menu overlay */}
      {showMenu && !message.is_deleted && (
        <div style={{
          position: 'absolute',
          top: '-15px',
          [isMe ? 'left' : 'right']: '-85px',
          background: 'rgba(20, 20, 30, 0.95)',
          border: '1px solid var(--glass-border)',
          borderRadius: '20px',
          padding: '4px 8px',
          display: 'flex',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 10
        }}>
          <button
            onClick={() => onReply(message)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
            title="Reply"
          >
            <FiCornerUpLeft />
          </button>
          
          <button
            onClick={() => onPin(message.id, !message.is_pinned)}
            style={{ background: 'none', border: 'none', color: message.is_pinned ? 'var(--accent-secondary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
            title={message.is_pinned ? 'Unpin' : 'Pin'}
          >
            <FiMapPin />
          </button>

          {isMe && message.content_type === 'text' && (
            <button
              onClick={() => setIsEditing(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              title="Edit"
            >
              <FiEdit2 />
            </button>
          )}

          {isMe && (
            <button
              onClick={() => onDelete(message.id)}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex' }}
              title="Delete"
            >
              <FiTrash2 />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
