
"use client";
import { useEffect, useState } from "react";
import { useUser } from "../../Context/UserContext";
import ProfileHeader from "../profileheader";
import { useParams, useRouter } from "next/navigation";
import Loading from "@/app/components/loading";
import EditProfile from "../editProfile";
import PingPongPerformanceChart from "../../home/chart";
import RPSSummary from "../RPSSummary";

type User = {
    id: number;
    name: string;
    picture?: string;
    gold?: number;
};

type Game = {
    id: number;
    winner_id?: number;
    player1_id?: number;
    player2_id?: number;
};

export default function Profile() {
    const [games, setGames] = useState<Game[]>([]);
    const [user, setUser] = useState<User | null>(null); 
    const [loading, setLoading] = useState(true);
    const { id } = useParams();
    const router = useRouter();
    const { user: currentUser } = useUser();
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
            if (!currentUser) return;
            
            try {
                const currId = (currentUser as { id?: number }).id;
                if (String(currId) === String(id)) {
                    setUser(currentUser);
                }
            } catch {
                
            }
        }, [currentUser, id]);


    useEffect(() => {
    }, [id]);

    useEffect(() => {
        const fetch_user = async () => {
            try {
                const response = await fetch(`/api/users/${id}`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (!response.ok) {
                    console.error("Failed to fetch user");
                    router.push("/404"); 
                    return;
                }
                const data = await response.json();
                setUser(data); 
            } catch (error) {
                console.error("Error fetching user:", error);
                router.push("/404");
            }
        };

        if (id) {
            fetch_user();
        }
    }, [id, router]);

    useEffect(() => {
        const fetch_games = async () => {
            try {
                const response = await fetch(`/api/games/${id}`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (!response.ok) {
                    console.error("Failed to fetch games");
                    setGames([]); 
                    return;
                }
                const data = await response.json();
                setGames(data);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching games:", error);
                setGames([]);
                setLoading(false);
            }
        };

        if (id) {
            fetch_games();
        }
    }, [id]);

    if (loading || !user) {
        return (
            <div className="flex items-center justify-center h-screen text-white animate-pulse">
                <Loading />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative">
            {editMode && (
                <EditProfile
                    setEditMode={setEditMode}
                    user={user}
                />
            )}
            <ProfileHeader user={user} games={games} setEditMode={setEditMode} />
            {}
            <div className="flex flex-col gap-4 max-h-[40%] p-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <PingPongPerformanceChart user={user} games={games} />
                    <RPSSummary
                    user={user}
                    games={games}
                    />
                </div>

            </div>
        </div>
    );
}