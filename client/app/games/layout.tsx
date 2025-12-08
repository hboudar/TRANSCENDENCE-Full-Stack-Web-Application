

"use client";
import { useEffect, useState } from "react";
import { useUser } from "../Context/UserContext";
import { HomeContext } from "./context";

type SkinType = "table" | "paddle" | "ball";
type Skin = {
	skin_id: number;
	type: SkinType;
	color: string;
	img: string;
	selected?: boolean;
	player_id: number;
};

type Selected = {
	types: Skin[];
	type: number; 
};

type MinimalUser = {
	id: number;
	name?: string;
	picture?: string;
} | null;

export default function Games({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const [selected, setselected] = useState<Selected>({ types: [], type: 0 });
	const [skins, setSkins] = useState<Skin[]>([]);
	const { user } = useUser() as { user: MinimalUser; loading: boolean };
	
	useEffect(() => {
		if (user) {
			async function fetchOwnedSkins() {
				try {
					const res = await fetch(
						"/api/player_skins"
					);
					if (!res.ok) {
						throw new Error("Failed to fetch player skins");
					}
					const data = await res.json();
					setSkins(data as Skin[]);
				} catch (error) {
					console.error("Error fetching owned skins data:", error);
				}
			}
			fetchOwnedSkins();
		}
	}, [user]);

	return (
		<HomeContext.Provider
			value={{ skins, user, selected, setSkins, setselected }}>
			{children}
		</HomeContext.Provider>
	);
}