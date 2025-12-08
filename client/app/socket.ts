'use client';

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

if (typeof window !== 'undefined') {
  socket = io(window.location.origin, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
    withCredentials: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnection: true,
    reconnectionAttempts: 5
  });

  socket.on("connect", () => {
  });

  socket.on("disconnect", (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on("connect_error", (error) => {
    console.error("🔴 Socket connection error:", error);
  });
}

export default socket;
