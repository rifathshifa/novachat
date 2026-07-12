import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { SocketContext } from '../context/SocketContext';
import api from '../services/api';

export const useChat = (activeContact) => {
  const { socket } = useContext(SocketContext);
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef(null);

  // ── Load chat history when active contact changes ──
  useEffect(() => {
    if (!activeContact) {
      setMessages([]);
      setHasMore(true);
      setSendError('');
      return;
    }

    const loadHistory = async () => {
      setLoadingHistory(true);
      setSendError('');
      try {
        const res = await api.get(`/messages/history`, {
          params: { contact_id: activeContact.id, limit: 30 },
        });
        setMessages(res.data);
        setHasMore(res.data.length === 30);
        // Scroll to bottom on load
        setTimeout(scrollToBottom, 100);
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

  }, [activeContact?.id, socket]);

  // ── Handle incoming socket events ──
  useEffect(() => {
    if (!socket || !activeContact) return;

    // ── Incoming message from the other person ──
    const handleNewMessage = (msg) => {
      if (msg.sender_id === activeContact.id) {
        setMessages((prev) => {
          // Dedup guard: don't add if already present
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Send read receipt immediately
        socket.emit('message_read', { contact_id: activeContact.id });
        setTimeout(scrollToBottom, 50);
      }
    };

    // ── Confirmation from server after we sent a message ──
    // Replaces the optimistic (temp) message with the real server record
    const handleSentConfirm = (msg) => {
      if (msg.receiver_id === activeContact.id) {
        setMessages((prev) => {
          // Replace optimistic temp message using client_temp_id, or dedup by real id
          if (msg.client_temp_id) {
            const exists = prev.some((m) => m.id === msg.id);
            if (exists) return prev; // already confirmed (multi-tab)
            // Replace the temp message
            const updated = prev.map((m) =>
              m.id === msg.client_temp_id ? msg : m
            );
            // If temp message was not found (timing edge case), append
            if (!updated.some((m) => m.id === msg.id)) {
              return [...updated, msg];
            }
            return updated;
          }
          // No temp id — just dedup and append
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
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
      const { message_id, content, is_deleted, is_pinned, is_edited, deleted_for_me } = data;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === message_id) {
            const updated = { ...msg };
            if (content !== undefined) updated.content = content;
            if (is_deleted !== undefined) updated.is_deleted = is_deleted;
            if (is_pinned !== undefined) updated.is_pinned = is_pinned;
            if (is_edited !== undefined) updated.is_edited = is_edited;
            // "delete for me" — remove from local list
            if (deleted_for_me) return null;
            return updated;
          }
          return msg;
        }).filter(Boolean)
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

    const handleMessageError = (data) => {
      console.error('[Socket] message_error:', data.error);
      setSendError(data.error || 'Failed to send message');
      // Remove optimistic message if it was added
      setMessages((prev) => prev.filter((m) => typeof m.id !== 'string'));
    };

    socket.on('message_new', handleNewMessage);
    socket.on('message_sent_confirm', handleSentConfirm);
    socket.on('message_status', handleMessageStatus);
    socket.on('message_update', handleMessageUpdate);
    socket.on('messages_marked_read', handleMarkedRead);
    socket.on('message_error', handleMessageError);

    return () => {
      socket.off('message_new', handleNewMessage);
      socket.off('message_sent_confirm', handleSentConfirm);
      socket.off('message_status', handleMessageStatus);
      socket.off('message_update', handleMessageUpdate);
      socket.off('messages_marked_read', handleMarkedRead);
      socket.off('message_error', handleMessageError);
    };
  }, [socket, activeContact?.id]);

  // ── Load older messages (pagination) ──
  const loadMoreMessages = async () => {
    if (loadingHistory || !hasMore || messages.length === 0 || !activeContact) return;

    setLoadingHistory(true);
    // Use the first real (non-temp) message's id as the cursor
    const realMessages = messages.filter((m) => typeof m.id === 'number');
    if (realMessages.length === 0) { setLoadingHistory(false); return; }
    const beforeId = realMessages[0].id;

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

  // ── Send a text message with optimistic UI ──
  const sendTextMessage = useCallback((content, parentId = null) => {
    if (!socket || !activeContact || !content.trim()) return;

    setSendError('');

    // Generate a temporary string ID for deduplication
    const tempId = `temp_${Date.now()}_${Math.random()}`;

    // Optimistic message — shown instantly while socket round-trips
    const optimisticMsg = {
      id: tempId,
      sender_id: null, // will be filled from context via server confirm
      receiver_id: activeContact.id,
      content: content.trim(),
      content_type: 'text',
      status: 'sending',
      created_at: new Date().toISOString(),
      is_deleted: false,
      is_pinned: false,
      is_edited: false,
      parent_id: parentId || null,
      reactions: {},
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(scrollToBottom, 50);

    socket.emit('message_send', {
      recipient_id: activeContact.id,
      content: content.trim(),
      content_type: 'text',
      parent_id: parentId,
      client_temp_id: tempId,
    });
  }, [socket, activeContact]);

  const sendAttachmentMessage = async (file) => {
    if (!activeContact) return { success: false, error: 'No active chat selected' };

    const formData = new FormData();
    formData.append('file', file);
    formData.append('contact_id', activeContact.id);

    try {
      // 1. Upload file via REST endpoint
      const response = await api.post('/messages/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { file_url, content_type, file_name, file_size } = response.data;

      // 2. Determine content category
      const category = content_type.startsWith('image/') ? 'image' :
                       content_type.startsWith('video/') ? 'video' :
                       content_type.startsWith('audio/') ? 'audio' : 'file';

      // 3. Emit over Socket.IO
      socket.emit('message_send', {
        recipient_id: activeContact.id,
        content: file_url,
        content_type: category,
        file_url: file_url,
        file_name: file_name,
        file_size: file_size,
      });

      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to upload attachment';
      return { success: false, error: errorMsg };
    }
  };

  const deleteMessage = useCallback((messageId) => {
    if (socket) {
      socket.emit('message_delete', { message_id: messageId });
    }
  }, [socket]);

  const editMessage = useCallback((messageId, newContent) => {
    if (socket && newContent.trim()) {
      socket.emit('message_edit', { message_id: messageId, new_content: newContent.trim() });
    }
  }, [socket]);

  const togglePinMessage = useCallback((messageId, isPinned) => {
    if (socket) {
      socket.emit('message_pin', { message_id: messageId, is_pinned: isPinned });
    }
  }, [socket]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return {
    messages,
    loadingHistory,
    hasMore,
    sendError,
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
