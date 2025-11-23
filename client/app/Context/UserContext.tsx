"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Cookies from "js-cookie";
import socket from "../socket";

export const UserContext = createContext({
  user: null,
  loading: true,
});

export const UserProvider = ({ children }) => {
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

  // Make user data available to all child components
  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
