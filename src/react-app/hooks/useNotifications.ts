import { useState, useEffect } from 'react';

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Carregar notificações do localStorage ao inicializar
  useEffect(() => {
    const saved = localStorage.getItem('notifications');
    if (saved) {
      try {
        setNotifications(JSON.parse(saved));
      } catch (error) {
        console.error('Erro ao carregar notificações:', error);
      }
    }
  }, []);

  // Salvar notificações no localStorage quando mudar
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications(prev => {
      // Verificar se já existe uma notificação similar recente (últimos 30 segundos)
      const now = new Date();
      const thirtySecondsAgo = new Date(now.getTime() - 30000);
      
      const isDuplicate = prev.some(existing => 
        existing.title === notification.title &&
        existing.message === notification.message &&
        existing.type === notification.type &&
        new Date(existing.timestamp) > thirtySecondsAgo
      );

      if (isDuplicate) {
        return prev; // Não adicionar se for duplicata
      }

      const newNotification: Notification = {
        ...notification,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        read: false
      };

      return [newNotification, ...prev.slice(0, 49)]; // Manter apenas 50 notificações
    });
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll
  };
}
