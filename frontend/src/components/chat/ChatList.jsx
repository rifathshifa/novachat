import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import api from '../../services/api';
import { FiSearch, FiSettings, FiLogOut, FiUser } from 'react-icons/fi';

// Media base URL (backend origin) — set VITE_UPLOADS_URL in .env
// Defaults to '' (same origin) for production. Serves from Flask in production.
const UPLOADS_URL = import.meta.env.VITE_UPLOADS_URL || '';

const ChatList = ({ activeContact, onSelectContact, onOpenSettings }) => {
  const { user, logout } = useContext(AuthContext);
  const { onlineUsers } = useContext(SocketContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [searching, setSearching] = useState(false);

  // Search users when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api.get(`/users/search?q=${searchQuery.trim()}`);
        setSearchResults(response.data);
      } catch (err) {
        console.error('Failed to search users', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Load recent contacts on load or active contact selection
  const loadRecentChats = async () => {
    try {
      // Try the dedicated contacts endpoint first; fall back to search
      let data;
      try {
        const response = await api.get('/users/contacts');
        data = response.data;
      } catch {
        // Fallback: search with single space returns all users
        const response = await api.get('/users/search?q= ');
        data = response.data;
      }
      setRecentChats(data);
    } catch (err) {
      console.error('Failed to load recent chats', err);
    }
  };

  useEffect(() => {
    loadRecentChats();
  }, [activeContact]);

  const handleSelect = (contact) => {
    onSelectContact(contact);
    setSearchQuery('');
    setSearchResults([]);
  };

  const displayedChats = searchQuery.trim() ? searchResults : recentChats;

  return (
    <div className="chat-sidebar">
      {/* Current User Header */}
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {user?.profile_image ? (
            <img
              src={`${UPLOADS_URL}${user.profile_image}`}
              alt={user.username}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--primary)',
                boxShadow: 'var(--shadow-sm)'
              }}
            />
          ) : (
            <div className="avatar-initials" style={{ width: '42px', height: '42px', fontSize: '0.95rem' }}>
              {user?.username?.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {user?.username}
            </span>
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              maxWidth: '150px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 500
            }}>
              {user?.custom_status || 'Set status...'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onOpenSettings}
            className="circle-btn"
            style={{ width: '36px', height: '36px', fontSize: '1.05rem' }}
            title="Profile Settings"
          >
            <FiSettings />
          </button>
          <button
            onClick={logout}
            className="circle-btn danger-action"
            style={{ width: '36px', height: '36px', fontSize: '1.05rem' }}
            title="Log Out"
          >
            <FiLogOut />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-wrapper">
        <input
          type="text"
          className="glass-input glass-input-capsule"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <FiSearch />
      </div>

      {/* Contact List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 16px 12px' }}>
        {searching && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px 0' }}>
            Searching...
          </p>
        )}
        
        {!searching && displayedChats.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px 0' }}>
            No contacts found
          </p>
        )}

        {displayedChats.map((contact) => {
          const isOnline = onlineUsers.has(contact.id) || contact.status === 'Online';
          const isActive = activeContact?.id === contact.id;

          return (
            <div
              key={contact.id}
              onClick={() => handleSelect(contact)}
              className={`chat-contact-item ${isActive ? 'active' : ''}`}
            >
              {/* Avatar block with status dot indicator */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {contact.profile_image ? (
                  <img
                    src={`${UPLOADS_URL}${contact.profile_image}`}
                    alt={contact.username}
                    style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div className="avatar-initials" style={{ width: '46px', height: '46px', fontSize: '0.95rem' }}>
                    {contact.username.substring(0, 2).toUpperCase()}
                  </div>
                )}
                
                {/* Online/Offline Badge */}
                <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
              </div>

              {/* Text metadata details block */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.925rem', color: 'var(--text-primary)' }}>
                    {contact.username}
                  </span>
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 500
                }}>
                  {contact.custom_status || (isOnline ? 'Online' : 'Offline')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChatList;
