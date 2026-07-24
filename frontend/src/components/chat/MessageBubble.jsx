import React, { useState } from 'react';
import { FiCheck, FiCornerUpLeft, FiEdit2, FiTrash2, FiMapPin, FiDownload, FiFileText } from 'react-icons/fi';
import VoiceMessagePlayer from './VoiceMessagePlayer';

// Media base URL (backend origin) — set VITE_UPLOADS_URL in .env
// Defaults to '' (same origin) for production. Serves from Flask in production.
const UPLOADS_URL = import.meta.env.VITE_UPLOADS_URL || '';

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

    if (message.status === 'sending') {
      return (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }} title="Sending...">
          ⏳
        </span>
      );
    } else if (message.status === 'read') {
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

    const fileUrl = message.content.startsWith('http')
      ? message.content
      : `${UPLOADS_URL}${message.content}`;

    switch (message.content_type) {
      case 'image':
        return (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="bubble-media-wrapper" style={{ display: 'block' }}>
            <img
              src={fileUrl}
              alt="Attachment"
              className="bubble-media-image"
            />
          </a>
        );
      case 'video':
        return (
          <div className="bubble-media-wrapper">
            <video
              src={fileUrl}
              controls
              className="bubble-media-image"
              style={{ objectFit: 'contain' }}
            />
          </div>
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
            className="bubble-file-card"
          >
            <FiFileText style={{ fontSize: '1.25rem', color: isMe ? '#ffffff' : 'var(--primary)', flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: 600 }}>
              {name.substring(32)} {/* Strip UUID prefix */}
            </span>
            <FiDownload style={{ flexShrink: 0 }} />
          </a>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`message-wrapper ${isMe ? 'me' : 'them'}`}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => {
        setShowMenu(false);
        setIsEditing(false);
      }}
    >
      {/* Bubble column: pin label + bubble card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isMe ? 'flex-end' : 'flex-start',
            gap: '2px',
            maxWidth: '420px',
            minWidth: 0,
          }}
        >
          {/* Pinned label indicator */}
          {message.is_pinned && !message.is_deleted && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: isMe ? 'var(--primary)' : 'var(--secondary)',
              marginBottom: '1px',
              padding: '0 4px'
            }}>
              <FiMapPin /> Pinned
            </div>
          )}

          {/* Message Bubble Card */}
          <div className={`bubble-card ${isMe ? 'me' : 'them'}`}>
            {isEditing ? (
              <div style={{ padding: '8px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <form onSubmit={handleEditSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="glass-input"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: '0.875rem', width: '180px', borderRadius: '12px' }}
                    autoFocus
                  />
                  <button type="submit" className="glass-btn">
                    Save
                  </button>
                </form>
              </div>
            ) : (
              <>
                {/* Text content or media attachment */}
                <div style={{ padding: message.content_type === 'text' ? '8px 12px 2px' : '6px 6px 2px' }}>
                  {message.is_deleted || message.content_type === 'text' ? (
                    <p
                      className="bubble-text-content"
                      style={{
                        fontStyle: message.is_deleted ? 'italic' : 'normal',
                        color: message.is_deleted
                          ? (isMe ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)')
                          : (isMe ? '#ffffff' : 'var(--text-primary)'),
                      }}
                    >
                      {message.content}
                    </p>
                  ) : (
                    renderAttachment()
                  )}
                </div>
              </>
            )}

            {/* Time & Receipt status bar — always on one horizontal line */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '3px',
              padding: '0 10px 6px',
              fontSize: '0.68rem',
              fontWeight: 500,
              color: isMe ? 'rgba(255, 255, 255, 0.65)' : 'var(--text-muted)',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              marginTop: '2px',
            }}>
              <span>{formatTime(message.created_at)}</span>
              {renderStatus()}
            </div>
          </div>
        </div>

      {/* Hover action menu overlay */}
      {showMenu && !message.is_deleted && (
        <div
          className="bubble-menu-overlay"
          style={{
            top: '-36px',
            [isMe ? 'right' : 'left']: '0',
          }}
        >
          <button
            onClick={() => onReply(message)}
            title="Reply"
          >
            <FiCornerUpLeft />
          </button>
          
          <button
            onClick={() => onPin(message.id, !message.is_pinned)}
            style={{ color: message.is_pinned ? 'var(--primary)' : 'var(--text-muted)' }}
            title={message.is_pinned ? 'Unpin' : 'Pin'}
          >
            <FiMapPin />
          </button>

          {isMe && message.content_type === 'text' && (
            <button
              onClick={() => setIsEditing(true)}
              title="Edit"
            >
              <FiEdit2 />
            </button>
          )}

          {isMe && (
            <button
              onClick={() => onDelete(message.id)}
              className="btn-danger-hover"
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
