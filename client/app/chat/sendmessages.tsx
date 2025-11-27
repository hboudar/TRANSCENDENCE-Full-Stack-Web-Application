"use client";
import { useEffect, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import socket from "../socket";
import { RiSendPlane2Fill } from "react-icons/ri";

export default function SendMessage({
  me,
  selected,
  isBlocked,
}: {
  me: number;
  selected: number;
  isBlocked?: boolean;
}) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!socket) return;

    socket.on("connect", () => {
      console.log("✅ Socket connected");
      socket.emit("join", me);
    });
    socket.on("disconnect", () => {
      console.log("🔌 Socket disconnected");
    });

    return () => {
      if (socket) {
        socket.off("connect");
        socket.off("disconnect");
      }
    };
  }, [me]);

  const sendMessage = () => {
    if (!message.trim() || !socket || isBlocked) return;
    const isSocketReady = socket.connected && navigator.onLine;
    const payload = {
      id: Date.now(), // Use timestamp as a simple unique ID
      content: message,
      sender_id: me,
      status: isSocketReady, // Check if the user is online
      receiver_id: selected,
      created_at: new Date().toISOString(), // Add timestamp for message creation
    };

    // setMessages((prev) => [...prev, payload]);

    // if (isSocketReady) {
      socket.emit("chat message", payload);
    // }
    // setMessages((prevMessages: any[]) => [...prevMessages, payload]);
    setMessage(""); // Clear the input field after sending
  };

  return (
    <div className="p-4 border-t border-gray-600 h-[12%]">
      <div className="relative flex items-center">
        <input
          type="text"
          value={message}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
          placeholder={isBlocked ? "Cannot send messages" : "Type your message..."}
          className="w-full py-3 pl-5 pr-12 border-[#3800d2]  border-1 text-white placeholder-gray-400 rounded-full focus:outline-none focus:ring-0 focus:ring-blue-500 transition-all duration-200"
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" && !isBlocked) {
              e.preventDefault();
              sendMessage();
            }
          }}
          disabled={isBlocked}
        />
        <button
          onClick={sendMessage}
          disabled={isBlocked}
          className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${isBlocked ? "text-gray-500 cursor-not-allowed" : "text-[#7700ff]"}  active:scale-95 transition-transform duration-150 `}
        >
          <RiSendPlane2Fill size={26} />
        </button>
      </div>
    </div>
  );
}
