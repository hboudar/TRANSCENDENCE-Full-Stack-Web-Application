"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "../Context/UserContext";
import socket from "@/app/socket";
import { useRouter } from "next/navigation";


type UserType = {
  id: number;
  name: string;
  picture?: string;
};

export default function Requests({ onClose, onFriendAccepted }: {
  onClose: () => void;
  onFriendAccepted?: () => void;
}) {
  const [requests, setRequests] = useState<UserType[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const { user, loading } = useUser();
  const router = useRouter();

  const fetchRequests = async () => {
    if (!user) return;

    try {
      const res = await fetch(
        `/api/friends/myrequests?userId=${user.id}`
      );
      const data = await res.json();
      setRequests(data.data || []);
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (!user || !socket) return;

    socket.emit("join", user.id);

    fetchRequests();

    socket.on("friends:request:incoming", fetchRequests);
    socket.on("friends:updated", fetchRequests);

    return () => {
      if (socket) {
        socket.off("friends:request:incoming", fetchRequests);
        socket.off("friends:updated", fetchRequests);
      }
    };
  }, [user]);

  const handleAccept = async (friendId: number) => {
    if (!user) return;

    try {
      const res = await fetch(`/api/friends/accept`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, friendId }),
      });

      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== friendId));
        onFriendAccepted?.();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDecline = async (friendId: number) => {
    if (!user) return;

    try {
      const res = await fetch(`/api/friends/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, friendId }),
      });

      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== friendId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p>Loading...</p>;

    return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1e] rounded-xl w-full max-w-sm p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white text-xl font-bold mb-4">Friend Requests</h2>

        <div className="max-h-64 overflow-y-auto space-y-2">
          {loadingRequests ? (
            <p className="text-gray-400 text-center py-4">Loading requests...</p>
          ) : requests.length > 0 ? (
            requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between px-3 py-2 bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors shadow-md"
              >
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => router.push(`/profile/${request.id}`)}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-600">
                    <img
                      src={request.picture}
                      alt={request.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-white font-medium">{request.name}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(request.id)}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-3 py-1 rounded-lg text-sm font-semibold transition-all"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDecline(request.id)}
                    className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white px-3 py-1 rounded-lg text-sm font-semibold transition-all"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-center py-4">No requests</p>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-2 rounded-xl transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
}
