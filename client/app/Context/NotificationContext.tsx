"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useUser } from "./UserContext";
import socket from "../socket";

interface Notification {
  id: number;
  user_id: number;
  sender_id: number;
  type: string;
  message: string;
  data: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  sender_picture?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  deleteNotification: (notificationId: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useUser();

  const fetchNotifications = async () => {
    if (!user?.id) return;

    try {
      const res = await fetch(`/api/notifications?userId=${user.id}`);
      const data = await res.json();
      setNotifications(data);
      setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const markAsRead = async (notificationId: number) => {
    if (!user?.id) return;

    try {
      await fetch(`/api/notifications/${notificationId}/read?userId=${user.id}`, {
        method: "PUT",
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    if (!user?.id) return;

    try {
      await fetch(`/api/notifications/${notificationId}?userId=${user.id}`, {
        method: "DELETE",
      });

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setUnreadCount((prev) => {
        const notification = notifications.find((n) => n.id === notificationId);
        return notification && !notification.is_read ? Math.max(0, prev - 1) : prev;
      });
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  useEffect(() => {
    if (!user?.id || !socket) return;

    fetchNotifications();

    const handleNewNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
      
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Game Invite!', {
          body: notification.message,
          icon: notification.sender_picture || '/profile.png'
        });
      }
    };

    const handleGameInviteExpired = (data: { senderId: number }) => {
      
      setNotifications((prev) => {
        const expiredUnread = prev.filter(
          (n: Notification) => n.type === 'game_invite' && n.sender_id === data.senderId && !n.is_read
        ).length;
        
        setUnreadCount((current: number) => Math.max(0, current - expiredUnread));
        
        return prev.filter((n: Notification) => !(n.type === 'game_invite' && n.sender_id === data.senderId));
      });
    };

    socket.on("new_notification", handleNewNotification);
    socket.on("game_invite_expired", handleGameInviteExpired);

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      if (socket) {
        socket.off("new_notification", handleNewNotification);
        socket.off("game_invite_expired", handleGameInviteExpired);
      }
    };
    
  }, [user?.id]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        fetchNotifications,
        markAsRead,
        deleteNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
