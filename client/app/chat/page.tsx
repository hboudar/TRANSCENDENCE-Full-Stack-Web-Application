"use client";

import { FaArrowRight, FaBan, FaUnlock } from "react-icons/fa";
import { useEffect, useState } from "react";
import Room from "./room";
import AvatarWithPresence from "../components/AvatarWithPresence";

import { useUser } from "../Context/UserContext";
import Sidebar from "./sidebar";
import Loading from "../components/loading";
import { FaTableTennisPaddleBall } from "react-icons/fa6";
import socket from "../socket";
import { useRouter } from "next/navigation";
import { showAlert } from "../components/Alert";

type User = {
    id: number;
    name: string;
    picture?: string;
    // add other properties as needed
};

type Message = {
    id?: number;
    content: string;
    sender_id: number;
    receiver_id: number;
    status: boolean;
    created_at?: string;
};

export default function Chat() {
    const rout = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [selected, setSelected] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]); // Initialize messages as an empty array
    const [isBlocked, setIsBlocked] = useState(false);
    const [isBlocker, setIsBlocker] = useState(false);
    const [blockLoading, setBlockLoading] = useState(false);
    const [blockMessage, setBlockMessage] = useState("");
    const { user, loading } = useUser();

    const checkBlockStatus = async () => {
        if (!selected || !user?.id) return;

        try {
            const res = await fetch(`/api/blocks/check/${user.id}/${selected}`);
            const data = await res.json();

            if (data.blocked) {
                setIsBlocked(true);
                setIsBlocker(data.is_blocker);
                if (data.is_blocker) {
                    setBlockMessage("You have blocked this user. Unblock to send messages.");
                } else {
                    setBlockMessage("This user has blocked you. You cannot send messages.");
                }
            } else {
                setIsBlocked(false);
                setIsBlocker(false);
                setBlockMessage("");
            }
        } catch (error) {
            console.error("Error checking block status:", error);
        }
    };

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener("resize", checkMobile); // Update isMobile on resize
        return () => window.removeEventListener("resize", checkMobile); // Cleanup listener on unmount
    }, []);

    useEffect(() => {
        async function fetchUsers() {
            try {
                // Fetch friends instead of all users
                if (!user?.id) return;
                const res = await fetch(`/api/friends/accepted?userId=${user.id}`);
                const data = await res.json();
                setUsers(data.data || []);
            } catch (error) {
                console.error("Error fetching friends:", error);
            }
        }
        if (user?.id) {
            fetchUsers();
        }
    }, [user?.id]);


    // Listen for real-time block/unblock events globally
    useEffect(() => {
        const handleUserBlocked = (data: { blocker_id: number; blocked_id: number }) => {
            console.log('Block event received:', data);
            if ((data.blocker_id === selected && data.blocked_id === user?.id) ||
                (data.blocker_id === user?.id && data.blocked_id === selected)) {
                checkBlockStatus();
            }
        };

        const handleUserUnblocked = (data: { blocker_id: number; blocked_id: number }) => {
            console.log('Unblock event received:', data);
            if ((data.blocker_id === selected && data.blocked_id === user?.id) ||
                (data.blocker_id === user?.id && data.blocked_id === selected)) {
                checkBlockStatus();
            }
        };

        socket.on('user_blocked', handleUserBlocked);
        socket.on('user_unblocked', handleUserUnblocked);

        return () => {
            socket.off('user_blocked', handleUserBlocked);
            socket.off('user_unblocked', handleUserUnblocked);
        };
    }, [selected, user]);

    // Fetch block status when user is selected
    useEffect(() => {
        if (selected && user?.id) {
            checkBlockStatus();
        }
    }, [selected, user?.id]);

    if (loading) {
        return <Loading />;
    }

    if (!user) {
        return <div className="flex items-center justify-center h-screen text-white">Failed to load user.</div>;
    }
    const me = user.id;

    const handleBlockToggle = async () => {
        if (!user?.id || !selected || blockLoading) return;

        // Only the blocker can unblock
        if (isBlocked && !isBlocker) {
            return;
        }

        setBlockLoading(true);
        try {
            if (isBlocked && isBlocker) {
                // Unblock (only if you are the blocker)
                const res = await fetch('/api/blocks', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        blocker_id: user.id,
                        blocked_id: selected
                    })
                });

                if (res.ok) {
                    setIsBlocked(false);
                    setIsBlocker(false);
                    setBlockMessage("");
                    // Emit unblock event via socket
                    console.log('Emitting user_unblocked event:', { blocker_id: user.id, blocked_id: selected });
                    socket.emit('user_unblocked', { blocker_id: user.id, blocked_id: selected });
                }
            } else if (!isBlocked) {
                // Block
                const res = await fetch('/api/blocks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        blocker_id: user.id,
                        blocked_id: selected
                    })
                });

                if (res.ok) {
                    setIsBlocked(true);
                    setIsBlocker(true);
                    setBlockMessage("You have blocked this user. Unblock to send messages.");
                    // Emit block event via socket
                    console.log('Emitting user_blocked event:', { blocker_id: user.id, blocked_id: selected });
                    socket.emit('user_blocked', { blocker_id: user.id, blocked_id: selected });
                }
            }
        } catch (error) {
            console.error("Error toggling block:", error);
        } finally {
            setBlockLoading(false);
        }
    };

    const handleSendGameInvite = () => {
        if (!socket) return;
        
        // Check if users are blocked
        if (isBlocked) {
            showAlert(
                isBlocker 
                    ? "You cannot send game invites to users you have blocked. Please unblock them first."
                    : "This user has blocked you. You cannot send them game invites.",
                'error'
            );
            return;
        }

        const recipient = users.find((u: User) => u.id === selected);
        if (!recipient) return;
        // Set flag to indicate this is an intentional private game creation
        sessionStorage.setItem('creatingPrivateGame', 'true');
        rout.push(`/games/game?gametype=online&oppid=${selected}`);
        console.log(selected, user.id);

        // Emit Socket.io event to send game invite
        socket.emit("send_game_invite", {
            recipientId: selected,
            gameType: "Pingpong"
        });

        // Listen for confirmation
        socket.once("game_invite_sent", (data: { success: boolean }) => {
            if (data.success) {
                showAlert(`Game invite sent to ${recipient.name}! 🎮`, 'success');
            }
        });
    };


    const showSidebar = !isMobile || (isMobile && selected === 0);
    const showChat = !isMobile || (isMobile && selected !== 0);

    return (
        <div className="flex h-full w-full text-white overflow-hidden">
            {showSidebar && (
                <Sidebar
                    users={users}
                    selected={selected}
                    setSelected={setSelected}
                    isMobile={isMobile}
                    me={me}
                />
            )}
            {showChat && (
                <div className="flex-1 flex flex-col">
                    {selected === 0 ? (
                        <div className="flex justify-center items-center h-full">
                            <h2 className="text-xl text-gray-500">Select a user to start chatting</h2>
                        </div>
                    ) : (
                        <>
                            <div className="flex  items-center border-b border-[#a0a0a0] px-4 py-3 gap-4">
                                <div className="flex items-center gap-4 justify-between flex-1">
                                    {isMobile && (
                                        <button
                                            className="text-gray-400 hover:text-white transition-colors rotate-180"
                                            onClick={() => setSelected(0)}
                                        >
                                            <FaArrowRight size={24} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            window.location.href = `/profile/${selected}`;
                                        }}
                                        className="flex items-center gap-4"
                                    >
                                        <AvatarWithPresence userId={selected} src={users.find((u: User) => u.id === selected)?.picture || "/profile.png"} sizeClass="w-12 h-12" imgClass="rounded-full shadow-md border border-gray-300" />
                                        <h2 className="text-xl font-semibold">
                                            {users.find((u: User) => u.id === selected)?.name}
                                        </h2>
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <button
                                            className={`flex items-center gap-2 px-2 py-1 rounded-xl font-semibold shadow-lg transition-all duration-200 ${isBlocker
                                                    ? "bg-gradient-to-r from-[#0080002f] to-emerald-300   text-white  "
                                                    : isBlocked
                                                        ? "bg-gray-600 cursor-not-allowed opacity-60"
                                                        : "bg-gradient-to-r from-[#ff000036] to-rose-300   text-white "
                                                } ${!isBlocked || isBlocker ? 'hover:scale-105 active:scale-95' : ''}`}
                                            onClick={handleBlockToggle}
                                            title={isBlocked ? (isBlocker ? "Unblock user" : "You are blocked by this user") : "Block user"}
                                            disabled={blockLoading || (isBlocked && !isBlocker)}
                                        >
                                            <span className="flex items-center justify-center text-xl">
                                                {blockLoading ? "..." : (isBlocker ? <FaUnlock /> : <FaBan />)}
                                            </span>
                                            <span className="hidden sm:inline">
                                                {blockLoading ? "Loading" : (isBlocker ? "Unblock" : isBlocked ? "Blocked" : "Block")}
                                            </span>
                                        </button>
                                        <button
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white shadow-lg transition-all duration-200 focus:outline-none ${
                                                isBlocked
                                                    ? "bg-gray-600 cursor-not-allowed opacity-60"
                                                    : "bg-gradient-to-r from-blue-700 via-purple-700 to-black border border-blue-900 hover:from-blue-500 hover:via-purple-600 hover:to-black hover:scale-105 active:scale-95 focus:ring-2 focus:ring-blue-400"
                                            }`}
                                            onClick={handleSendGameInvite}
                                            disabled={isBlocked}
                                            title={isBlocked ? "Cannot play with blocked users" : "Play with user"}
                                        >
                                            <span className="flex items-center justify-center text-xl">
                                                <FaTableTennisPaddleBall />
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <Room selected={selected} me={me} messages={messages} setMessages={setMessages} isBlocked={isBlocked} blockMessage={blockMessage} />
                            </div>
                        </>
                    )}
                </div>
            )
            }
        </div >
    );
}
