"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Cookies from "js-cookie";
import socket from "../socket";

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
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const token = Cookies.get("token");
        
        if (!token) {
          setLoading(false);
          return;
        }

        const res = await fetch("http://localhost:4000/me", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        
        if (!res.ok) {
          if (res.status === 401) {
            Cookies.remove("token");
          }
          setLoading(false);
          return;
        }
        
        const data = await res.json();
        setUser(data);
        
        if (data?.id) {
          socket.emit("join", data.id);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, []);

  // Listen for profile updates from other clients and update global user
  useEffect(() => {
    const handler = (payload: any) => {
      try {
        if (!payload || !payload.userId) return;
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
