"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "../Context/UserContext";
import Loading from "../components/loading";
import socket from "@/app/socket";
import { useRouter } from "next/navigation";


export async function CancelFriendRequest(userId: number, friendId: number) {
  try {
    const res = await fetch(`/api/friends/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, friendId }),
    });
    return res.ok;
  } catch (err) {
    console.error(err);
    return false;
  }
}

export async function AddFriendRequest(userId: number, friendId: number) {
  try {
    const res = await fetch(`/api/friends`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, friendId }),
    });
    
    if (res.ok) {
      if (socket) {
        socket.emit("friends:request:send", {
          fromUserId: userId,
          toUserId: friendId,
        });
      }
    }

    return res.ok;
  } catch (err) {
    console.error(err);
    return false;
  }
}

type UserType = {
  id: number;
  name: string;
  picture?: string;
  gold?: number;
};

const AddFriend = ({ onClose }: { onClose: () => void }) => {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserType[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [requestedIds, setRequestedIds] = useState<number[]>([]);
  const [incomingRequestIds, setIncomingRequestIds] = useState<number[]>([]);
  const [friendsIds, setFriendsIds] = useState<number[]>([]);
  const { user, loading } = useUser();
  const router = useRouter();
  
  useEffect(() => {
    if (!user || !socket) return;

    socket.emit("join", user.id);

    let isMounted = true;

    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/users");
        const data: UserType[] = await res.json();
        if (isMounted) setUsers(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    };

    const fetchOutgoingRequests = async () => {
      try {
        const res = await fetch(
          `/api/friends/request?userId=${user.id}`
        );
        const data = await res.json();
        setRequestedIds(data.data.map((r) => r.friend_id));
      } catch (err) {
        console.error(err);
      }
    };

    const fetchIncomingRequests = async () => {
      try {
        const res = await fetch(
          `/api/friends/myrequests?userId=${user.id}`
        );
        const data = await res.json();
        setIncomingRequestIds(data.data.map((r) => r.user_id));
      } catch (err) {
        console.error(err);
      }
    };

    const fetchFriends = async () => {
      try {
        const res = await fetch(
          `/api/friends/accepted?userId=${user.id}`
        );
        const data = await res.json();
        setFriendsIds(data.data.map((f) => f.id));
      } catch (err) {
        console.error(err);
      }
    };

    fetchUsers();
    fetchOutgoingRequests();
    fetchIncomingRequests();
    fetchFriends();

    socket.on("friends:request:incoming", fetchIncomingRequests);
    socket.on("friends:updated", fetchFriends);

    return () => {
      isMounted = false;
      if (socket) {
        socket.off("friends:request:incoming", fetchIncomingRequests);
        socket.off("friends:updated", fetchFriends);
      }
    };
  }, [user]);

  const handleAddFriend = async (friendId: number) => {
    if (!user) return;
    if (requestedIds.includes(friendId)) return;

    const success = await AddFriendRequest(user.id, friendId);
    if (success) setRequestedIds((prev) => [...prev, friendId]);
  };

  const handleCancelRequest = async (friendId: number) => {
    if (!user) return;
    const success = await CancelFriendRequest(user.id, friendId);
    if (success)
      setRequestedIds((prev) => prev.filter((id) => id !== friendId));
  };

  const filteredUsers = users
    .filter((u) => u.id !== user?.id)
    .filter((u) => !friendsIds.includes(u.id))
    .filter((u) => !incomingRequestIds.includes(u.id))
    .filter((u) => u.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <Loading />;

   return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1e] rounded-xl w-full max-w-sm p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white text-xl font-bold mb-4">Add Friends</h2>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full mb-4 px-3 py-2 rounded-xl bg-gray-800 text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-purple-600"
        />

        <div className="max-h-64 overflow-y-auto space-y-2">
          {loadingUsers ? (
            <Loading />
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map((u) => {
              const isRequested = requestedIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-3 py-2 bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors shadow-md"
                >
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => router.push(`/profile/${u.id}`)}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-600">
                      <img
                        src={u.picture}
                        alt={u.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-white font-medium">{u.name}</span>
                  </div>

                  <button
                    onClick={() =>
                      isRequested
                        ? handleCancelRequest(u.id)
                        : handleAddFriend(u.id)
                    }
                    className={`px-3 py-1 rounded-lg text-sm font-semibold text-white transition-all ${
                      isRequested
                        ? "bg-gray-700 hover:bg-gray-600"
                        : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                    }`}
                  >
                    {isRequested ? "Request Sent" : "Add"}
                  </button>
                </div>
              );
            })
          ) : (
            <p className="text-gray-400 text-center py-4">
              No users found
            </p>
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
};

export default AddFriend;
