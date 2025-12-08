"use client";

import AvatarWithPresence from "../components/AvatarWithPresence";
import { usePresence } from "../Context/PresenceContext";

export default function UserInfo({
  user,
  setSelected,
  selected
}: {
  user: {
    id: number;
    name: string;
    picture?: string;
  };
  selected: number;
  setSelected: (id: number) => void;
}) {
  const { isOnline } = usePresence();
  const online = isOnline(user.id);

  const selectedhandler = () => {
    setSelected(user.id);
  };

  return (
    <div
      key={user.id}
      className={`flex p-1 items-center hover:bg-[#a9a8a847] rounded-lg transition-colors duration-200 cursor-pointer ${selected === user.id ? 'bg-[#a9a8a847]' : ''}`}
      onClick={selectedhandler}
    >
      <div className="m-2">
        <AvatarWithPresence userId={user.id} src={user.picture || "/profile.png"} alt={user.name} />
      </div>
      <div className="flex flex-col">
        <h3 className="text-white font-semibold">{user.name}</h3>
        <p className="text-gray-400 text-sm">{online ? "Online" : "Offline"}</p>
      </div>

    </div>
  );
}
