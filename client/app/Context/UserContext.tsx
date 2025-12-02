"use client";
import { createContext, useContext, useEffect, useState } from "react";
import socket from "../socket";

// User interface with proper typing
interface User {
  id: number;
  name: string;
  email: string;
  picture?: string;
  [key: string]: unknown;
}

// Context type definition
interface UserContextType {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
}

// Create context for sharing user data across components
export const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  // expose a setter so components can update user immediately after mutations
  setUser: () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);      // Store user data (name, email, picture, etc)
  const [loading, setLoading] = useState(true); // Track if we're still fetching user data

  // Fetch User Data on App Load
  // Runs once when app starts to verify token and get user info
  useEffect(() => {
    const fetchMe = async () => {
      try {
        console.log('🔍 UserContext: Fetching user data from /api/me');
        
        // Verify token with backend /me endpoint (token is in httpOnly cookie)
        const res = await fetch("/api/me", {
          credentials: 'include',  // Automatically sends httpOnly cookie
        });
        
        console.log('📡 UserContext: Response status:', res.status);
        
        if (!res.ok) {
          console.warn('⚠️ UserContext: Failed to fetch user, status:', res.status);
          setUser(null);
          setLoading(false);
          return;
        }
        
        // Token valid - save user data
        const data = await res.json();
        console.log('✅ UserContext: User data fetched successfully:', data);
        setUser(data);
        
        // Join socket room for real-time chat/notifications
        if (data?.id && socket) {
          console.log('🔌 UserContext: Joining socket room for user:', data.id);
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

  // Real-time Profile Updates
  // Listen for profile updates from other clients and sync user data
  useEffect(() => {
    if (!socket) return;

    const handler = (payload: Partial<User> & { userId?: number }) => {
      try {
        if (!payload || !payload.userId) return;
        // Only update if the update is for current user
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

  // Make user data available to all child components
  return (
    <UserContext.Provider value={{ user, loading, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
