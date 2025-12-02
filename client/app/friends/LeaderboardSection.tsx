"use client";

import { useState, useEffect, useCallback } from "react";
import UsersCard from "./UsersCard";
import BottomButtons from "./BottomButtons";
import Loading from "../components/loading";
import { useUser } from "../Context/UserContext";
import socket from "@/app/socket";

type Friend = {
  id: number;
  name: string;
  picture?: string;
  gold?: number;
};

const LeaderboardSection = () => {
  const { user, loading } = useUser();
  const [friends, setFriends] = useState<Friend[]>([]);

  const fetchFriends = useCallback(async () => {
    if (!user) return;

    try {
      const res = await fetch(
        `/api/friends/accepted?userId=${user.id}`
      );
      const data = await res.json();
      setFriends(data.data); // 🔥 favorite removed
    } catch (err) {
      console.error("Failed to fetch friends:", err);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !socket) return;

    socket.emit("join", user.id);

    fetchFriends();

    socket.on("friends:updated", fetchFriends);

    return () => {
      if (socket) {
        socket.off("friends:updated", fetchFriends);
      }
    };
  }, [user, fetchFriends]);

  if (loading) return <Loading />;

  return (
    <div className="w-full max-w-[100rem] p-2 relative flex flex-col h-screen max-h-screen">
      <BottomButtons onRefreshFriends={fetchFriends} />

      {friends.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-400 text-lg font-semibold">
            You have no friends now
          </span>
        </div>
      ) : (
        <UsersCard friends={friends} setUsers={setFriends} />
      )}
    </div>
  );
};

export default LeaderboardSection;
