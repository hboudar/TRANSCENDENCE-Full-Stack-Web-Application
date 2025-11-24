"use client";

import { useState, useEffect, useCallback } from "react";
import UsersCard from "./UsersCard";
import BottomButtons from "./BottomButtons";
import Loading from "../components/loading";
import { useUser } from "../Context/UserContext";
import socket from "@/app/socket";

const LeaderboardSection = () => {
  const { user, loading } = useUser();
  const [friends, setFriends] = useState([]);
  const [refreshToggle, setRefreshToggle] = useState(false);

  const fetchFriends = useCallback(async () => {
    if (!user) return;

    try {
      const res = await fetch(
        `http://localhost:4000/friends/accepted?userId=${user.id}`
      );
      const data = await res.json();
      setFriends(data.data || []); // ensure array even if empty
    } catch (err) {
      console.error("Failed to fetch friends:", err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    socket.emit("join", user.id);

    fetchFriends();

    socket.on("friends:updated", fetchFriends);

    return () => {
      socket.off("friends:updated", fetchFriends);
    };
  }, [user, fetchFriends]);

  if (loading) return <Loading />;

  return (
    <div className="w-full max-w-[100rem] p-2 relative flex flex-col h-screen max-h-screen">
      <BottomButtons onRefreshFriends={() => setRefreshToggle((prev) => !prev)} />

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
