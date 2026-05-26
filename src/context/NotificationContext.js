"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

const NotificationContext = createContext({});

let notifIdCounter = 0;

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const timersRef = useRef({});

  const removeNotification = useCallback((id) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((type, title, message, duration = 5000) => {
    const id = ++notifIdCounter;
    const notification = { id, type, title, message, createdAt: Date.now(), duration };

    setNotifications((prev) => {
      const next = [...prev, notification];
      // Max 5 notifications stacked
      if (next.length > 5) {
        const removed = next.shift();
        if (timersRef.current[removed.id]) {
          clearTimeout(timersRef.current[removed.id]);
          delete timersRef.current[removed.id];
        }
      }
      return next;
    });

    // Auto-dismiss
    timersRef.current[id] = setTimeout(() => {
      removeNotification(id);
    }, duration);

    return id;
  }, [removeNotification]);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);
