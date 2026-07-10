import { useState, useEffect, useContext, useRef } from 'react';
import { SocketContext } from '../context/SocketContext';
import api from '../services/api';

export const useChat = (activeContact) => {
  const { socket } = useContext(SocketContext);
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef(null);

  // Load chat history when active contact changes
  useEffect(() => {
    if (!activeContact) {
      setMessages([]);
      setHasMore(true);
      return;
    }

    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await api.get(`/messages/history`, {
          params: { contact_id: activeContact.id, limit: 30 },
        });
        setMessages(res.data);
        setHasMore(res.data.length === 30);
        // Scroll to bottom on load
        setTimeout(scrollToBottom, 50);
      } catch (err) {
        console.error('Failed to load chat history', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();
    
    // Mark messages as read when opening a thread
    if (socket) {
      socket.emit('message_read', { contact_id: activeContact.id });
    }

  }, [activeContact, socket]);

  // Handle incoming socket events
  useEffect(() => {
    if (!socket || !activeContact) return;

    const handleNewMessage = (msg) => {
      // Check if the message is from our active chat contact
      if (msg.sender_id === activeContact.id) {
        setMessages((prev) => [...prev, msg]);
        // Send read receipt
        socket.emit('message_read', { contact_id: activeContact.id });
        setTimeout(scrollToBottom, 50);
      }
    };

    const handleSentConfirm = (msg) => {
      // Check if confirmation message is to our active contact
      if (msg.receiver_id === activeContact.id) {
        setMessages((prev) => [...prev, msg]);
        setTimeout(scrollToBottom, 50);
      }
    };

    const handleMessageStatus = (data) => {
      const { message_id, status } = data;
      setMessages((prev) =>
        prev.map((msg) => (msg.id === message_id ? { ...msg, status } : msg))
      );
    };

    const handleMessageUpdate = (data) => {
      const { message_id, content, is_deleted, is_pinned, is_edited } = data;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === message_id) {
            const updated = { ...msg };
            if (content !== undefined) updated.content = content;
            if (is_deleted !== undefined) updated.is_deleted = is_deleted;
            if (is_pinned !== undefined) updated.is_pinned = is_pinned;
            if (is_edited !== undefined) updated.is_edited = is_edited;
            return updated;
          }
          return msg;
        })
      );
    };

    const handleMarkedRead = (data) => {
      if (data.contact_id === activeContact.id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender_id === activeContact.id ? { ...msg, status: 'read' } : msg
          )
        );
      }
    };

    socket.on('message_new', handleNewMessage);
    socket.on('message_sent_confirm', handleSentConfirm);
    socket.on('message_status', handleMessageStatus);
    socket.on('message_update', handleMessageUpdate);
    socket.on('messages_marked_read', handleMarkedRead);

    return () => {
      socket.off('message_new', handleNewMessage);
      socket.off('message_sent_confirm', handleSentConfirm);
      socket.off('message_status', handleMessageStatus);
      socket.off('message_update', handleMessageUpdate);
      socket.off('messages_marked_read', handleMarkedRead);
    };
  }, [socket, activeContact]);

  // Load older messages for pagination (cursor-based)
  const loadMoreMessages = async () => {
    if (loadingHistory || !hasMore || messages.length === 0 || !activeContact) return;
    
    setLoadingHistory(true);
    const beforeId = messages[0].id;
    
    try {
      const res = await api.get(`/messages/history`, {
        params: { contact_id: activeContact.id, limit: 30, before_id: beforeId },
      });
      
      if (res.data.length > 0) {
        setMessages((prev) => [...res.data, ...prev]);
      }
      setHasMore(res.data.length === 30);
    } catch (err) {
      console.error('Failed to load older messages', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const sendTextMessage = (content, parentId = null) => {
    if (!socket || !activeContact || !content.trim()) return;
    
    socket.emit('message_send', {
      recipient_id: activeContact.id,
      content: content.trim(),
      content_type: 'text',
      parent_id: parentId,
    });
  };

  const sendAttachmentMessage = async (file) => {
    if (!activeContact) return { success: false, error: 'No active chat selected' };
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('contact_id', activeContact.id);
    
    try {
      // 1. Upload file via HTTPS REST Endpoint
      const response = await api.post('/messages/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const { file_url, content_type, filename } = response.data;
      
      // 2. Emit file details over Socket.IO stream
      socket.emit('message_send', {
        recipient_id: activeContact.id,
        content: file_url,
        content_type: content_type.startsWith('image/') ? 'image' : 
                     content_type.startsWith('video/') ? 'video' :
                     content_type.startsWith('audio/') ? 'audio' : 'file',
      });
      
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to upload attachment';
      return { success: false, error: errorMsg };
    }
  };

  const deleteMessage = (messageId) => {
    if (socket) {
      socket.emit('message_delete', { message_id: messageId });
    }
  };

  const editMessage = (messageId, newContent) => {
    if (socket && newContent.trim()) {
      socket.emit('message_edit', { message_id: messageId, new_content: newContent.trim() });
    }
  };

  const togglePinMessage = (messageId, isPinned) => {
    if (socket) {
      socket.emit('message_pin', { message_id: messageId, is_pinned: isPinned });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return {
    messages,
    loadingHistory,
    hasMore,
    loadMoreMessages,
    sendTextMessage,
    sendAttachmentMessage,
    deleteMessage,
    editMessage,
    togglePinMessage,
    scrollToBottom,
    messagesEndRef,
  };
};
