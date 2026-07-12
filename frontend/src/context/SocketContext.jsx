import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import { getAccessToken } from '../services/api';

export const SocketContext = createContext(null);

// Backend Socket.IO URL — read from env at build time
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      // Disconnect and clean up when logged out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setOnlineUsers(new Set());
      setTypingUsers({});
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    // Disconnect any existing socket before creating a new one
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    newSocket.on('presence_change', (data) => {
      const { user_id, status } = data;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (status === 'Online') {
          next.add(user_id);
        } else {
          next.delete(user_id);
        }
        return next;
      });
    });

    newSocket.on('typing_start', (data) => {
      const { sender_id } = data;
      setTypingUsers((prev) => ({ ...prev, [sender_id]: true }));
    });

    newSocket.on('typing_stop', (data) => {
      const { sender_id } = data;
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[sender_id];
        return next;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const value = {
    socket,
    onlineUsers,
    typingUsers,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
