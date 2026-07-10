import React, { createContext, useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import { getAccessToken } from '../services/api';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setOnlineUsers(new Set());
      setTypingUsers({});
      return;
    }

    const token = getAccessToken();
    const newSocket = io('http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    newSocket.on('connect', () => {
      console.log('Socket.IO connected');
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
    };
  }, [user]);

  const value = {
    socket,
    onlineUsers,
    typingUsers,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
