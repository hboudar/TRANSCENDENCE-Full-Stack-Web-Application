"use client";
import { createContext, useContext, useEffect, useState } from "react";
import socket from "../socket";

interface User {
  id: number;
  name: string;
  email: string;
  picture?: string;
  [key: string]: unknown;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
}

export const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  
  setUser: () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);      
  const [loading, setLoading] = useState(true); 

  
  useEffect(() => {
    const fetchMe = async () => {
      try {
        
        const res = await fetch("/api/me", {
          credentials: 'include',  
        });
        
        if (!res.ok) {
          console.warn('⚠️ UserContext: Failed to fetch user, status:', res.status);
          setUser(null);
          setLoading(false);
          return;
        }
        
        const data = await res.json();
        setUser(data);
        
        if (data?.id && socket) {
          socket.emit("join", data.id);
        }
      } catch (error) {
        console.error("❌ UserContext: Error fetching user:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, []);

  
  useEffect(() => {
    if (!socket) return;

    const handler = (payload: Partial<User> & { userId?: number }) => {
      try {
        if (!payload || !payload.userId) return;
        
        setUser((prev: User | null) => {
          if (!prev) return prev;
          if (prev.id === payload.userId) {
            return { ...prev, ...(payload || {}) };
          }
          return prev;
        });
      } catch (err) {
        console.error('Error applying user_profile_updated payload', err);
      }
    };

    socket.on('user_profile_updated', handler);
    return () => {
      if (socket) {
        socket.off('user_profile_updated', handler);
      }
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
