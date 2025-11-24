"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Cookies from "js-cookie";
import socket from "../socket";

// Create context for sharing user data across components
export const UserContext = createContext({
  user: null,
  loading: true,
  // expose a setter so components can update user immediately after mutations
  setUser: (u: any) => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState(null);      // Store user data (name, email, picture, etc)
  const [loading, setLoading] = useState(true); // Track if we're still fetching user data

  // Fetch User Data on App Load
  // Runs once when app starts to verify token and get user info
  useEffect(() => {
    const fetchMe = async () => {
      try {
        // Get token from cookies
        const token = Cookies.get("token");
        
        if (!token) {
          setUser(null);
          setLoading(false);
          return;
        }

        // Verify token with backend /me endpoint
        const res = await fetch("http://localhost:4000/me", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        
        if (!res.ok) {
          // Remove invalid/expired/orphaned tokens
          // 401 = token invalid/expired, 404 = user deleted from database
          if (res.status === 401 || res.status === 404) {
            Cookies.remove("token");
            setUser(null);
          }
          setLoading(false);
          return;
        }
        
        // Token valid - save user data
        const data = await res.json();
        setUser(data);
        
        // Join socket room for real-time chat/notifications
        if (data?.id) {
          socket.emit("join", data.id);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        Cookies.remove("token");
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
    const handler = (payload: any) => {
      try {
        if (!payload || !payload.userId) return;
        // Only update if the update is for current user
        setUser((prev: any) => {
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
    return () => { socket.off('user_profile_updated', handler); };
  }, []);

  // Make user data available to all child components
  return (
    <UserContext.Provider value={{ user, loading, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
