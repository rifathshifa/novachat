import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import api from '../../services/api';
import { FiSearch, FiSettings, FiLogOut, FiUser } from 'react-icons/fi';

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
      // In a real app we might fetch user lists, we'll fetch from search with empty or list recent
      // For this MVP, we will fetch users by search query " " or load active contact list
      const response = await api.get('/users/search?q=');
      // Or search with a wildcard to simulate recent contact list or empty query returns all
      setRecentChats(response.data);
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
      <div style={{
        padding: '20px',
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user?.profile_image ? (
            <img
              src={`http://localhost:5000${user.profile_image}`}
              alt={user.username}
              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-primary)' }}
            />
          ) : (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, #00e5ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              color: '#fff'
            }}>
              {user?.username?.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{user?.username}</span>
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              maxWidth: '160px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {user?.custom_status || 'Set status...'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onOpenSettings}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.15rem' }}
            title="Profile Settings"
          >
            <FiSettings />
          </button>
          <button
            onClick={logout}
            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.15rem' }}
            title="Log Out"
          >
            <FiLogOut />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ padding: '15px', position: 'relative' }}>
        <input
          type="text"
          className="glass-input"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', paddingLeft: '40px' }}
        />
        <FiSearch style={{
          position: 'absolute',
          left: '28px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)'
        }} />
      </div>

      {/* Contact List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px 10px' }}>
        {searching && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '15px' }}>
            Searching...
          </p>
        )}
        
        {!searching && displayedChats.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '15px' }}>
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
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: '12px',
                cursor: 'pointer',
                marginBottom: '5px',
                transition: 'all 0.2s ease',
                background: isActive ? 'rgba(124, 77, 255, 0.15)' : 'transparent',
                border: isActive ? '1px solid rgba(124, 77, 255, 0.2)' : '1px solid transparent'
              }}
              className="chat-contact-item"
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Avatar block with status dot indicator */}
              <div style={{ position: 'relative' }}>
                {contact.profile_image ? (
                  <img
                    src={`http://localhost:5000${contact.profile_image}`}
                    alt={contact.username}
                    style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    fontSize: '1rem',
                    border: '1px solid var(--glass-border)'
                  }}>
                    {contact.username.substring(0, 2).toUpperCase()}
                  </div>
                )}
                
                {/* Online Badge */}
                <div style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: isOnline ? 'var(--success)' : '#757575',
                  border: '2px solid #0d0d1e'
                }} />
              </div>

              {/* Text metadata details block */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                    {contact.username}
                  </span>
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
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
