

import { Pencil } from "lucide-react";
import Games_status from "../home/games_status";
import { useUser } from "../Context/UserContext";
import { usePresence } from "../Context/PresenceContext";

type Game = {
    id: number;
    winner_id?: number;
    player1_id?: number;
    player2_id?: number;
};

type User = {
    id: number;
    name: string;
    picture?: string;
    gold?: number;
};

export default function ProfileHeader({ user, games, setEditMode }: { user: User; games: Game[]; setEditMode: (editMode: boolean) => void }) {
    const wins = games.filter((game: Game) => game.winner_id === user.id).length;
    const draw = games.filter((game: Game) => game.winner_id === 0).length;
    const progress = (wins + (draw / 2)) % 10;
    const xp = (wins * 100) + draw * 50;
    const level = Math.floor((wins + (draw / 2)) / 10);
    const goldearned = user.gold;

        const { isOnline } = usePresence();
        const online = user?.id ? isOnline(user.id) : false;
        const { user: currentUser } = useUser();
    return (

        <div className="relative w-full h-full flex flex-col items-center flex-1/6 justify-end">

            {/* Background */}
            <img
                src="/profile.png"
                alt="background"
                className="absolute top-2 left-[2%] w-[96%] h-[85%] object-cover rounded-2xl z-0 bg-cover bg-center shadow-lg"
            />

            {/* Main container */}
            <div className="relative z-10 w-[90%] flex flex-col lg:flex-row justify-between items-center rounded-2xl p-2  bg-gradient-to-br from-gray-900 via-purple-900/20 to-blue-900/20  border border-purple-500/30 shadow-2xl backdrop-blur-md gap-6">

                {/* LEFT SIDE : Profile Info */}
                <div className="flex flex-col items-center lg:items-start gap-4 w-full lg:w-1/2">
                    {/* Image and Name Row */}
                    <div className="flex items-center gap-4 w-full">
                        <div className={`relative inline-block overflow-visible flex-shrink-0`}>
                            <img
                                src={user.picture || '/profile.png'}
                                alt={user.name}
                                className={`w-16 h-16 sm:w-20 sm:h-20 lg:w-22 lg:h-22 rounded-full object-cover border-2 border-purple-500/50 shadow-lg`}
                                referrerPolicy="no-referrer"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/profile.png' }}
                            />
                            <span
                                className={`absolute left-1 bottom-1 w-3 h-3 rounded-full ring-2 ring-black/80 ${online ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}
                                title={online ? 'Online' : 'Offline'}
                                aria-label={online ? 'online' : 'offline'}
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate">{user.name}</h2>
                            {currentUser && String(currentUser.id) === String(user.id) ? (
                                <Pencil size={18} className="cursor-pointer text-gray-400 hover:text-white transition-colors flex-shrink-0" onClick={() => setEditMode(true)} />
                            ) : null}
                        </div>
                    </div>

                    {/* Gold, Level, XP, and Progress Bar */}
                    <div className="flex flex-col gap-2 w-full">
                        <div className="flex items-center justify-between w-full">
                            <span className="text-blue-400 font-bold animate-pulse text-sm sm:text-base">
                                Gold: {goldearned} $
                            </span>
                            <span className="text-gray-300 font-semibold text-xs sm:text-sm">{xp} XP</span>
                        </div>
                        <div className="flex items-center justify-between w-full">
                            <span className="bg-[#2121e250] text-white font-bold px-2 py-1 rounded shadow-md border border-white/10 text-xs tracking-wide">
                                Level {level}
                            </span>
                        </div>

                        <div className="relative w-full h-3 rounded-full overflow-hidden bg-gray-700/50 shadow-inner">
                            <div
                                className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-[#0303ff] to-[#7537fb] transition-all duration-500"
                                style={{ width: `${progress * 10}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
                <div className="w-full lg:w-1/2 flex justify-end">
                    <Games_status userId={user.id} />
                </div>
            </div>
        </div>
    );
}
