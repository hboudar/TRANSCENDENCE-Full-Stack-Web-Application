"use client";

import { UserX, Gamepad2, Trophy, TrendingDown } from "lucide-react";
import socket from "@/app/socket";
import { useRouter } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";

type User = {
  id: number;
  name: string;
  picture?: string;
  level?: number;
  games?: number;
  win?: number;
  lose?: number;
  gold?: number;
};

type CurrentUser = {
  id: number;
  name: string;
};

export default function UserInfo({
  user,
  currentUser,
  setUsers,
}: {
  user: User;
  currentUser: CurrentUser | null;
  setUsers: Dispatch<SetStateAction<User[]>>;
}) {
  const removeFriend = async () => {
    if (!currentUser) return;

    const userId = currentUser.id;
    const friendId = user.id;

    const res = await fetch(`/api/friends/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, friendId }),
    });

    if (res.ok) {
      socket.emit("friends:updated", { userA: userId, userB: friendId });
      setUsers((prev: User[]) => prev.filter((u) => u.id !== friendId));
    }
  };

  const router = useRouter();
  return (
    <div className="bg-purple-700/40 backdrop-blur-sm rounded-lg p-4 flex items-center justify-between hover:bg-purple-700/50 transition-all">
      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-4 cursor-pointer"
          onClick={() => router.push(`/profile/${user.id}`)}
        >
          <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
            <img
              src={user.picture}
              alt={user.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex flex-col">
            <h3 className="text-white font-semibold text-lg">
              {user.name}{" "}
              <span className="text-orange-400 text-sm">
                lvl {user.level || 0}
              </span>
            </h3>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-white" />
          <span className="text-white text-sm">{user.games || 0}</span>
        </div>

        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-white" />
          <span className="text-white text-sm">{user.win || 0}</span>
        </div>

        <div className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-white" />
          <span className="text-white text-sm">{user.lose || 0}</span>
        </div>

        <button
          onClick={removeFriend}
          className="text-red-500 hover:text-red-600 transition-colors"
        >
          <UserX className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
