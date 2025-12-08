"use client";
import { createContext, useContext } from "react";

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

export type HomeContextType = {
	skins: Skin[];
	user: MinimalUser;
	selected: Selected;
	setSkins: React.Dispatch<React.SetStateAction<Skin[]>>;
	setselected: React.Dispatch<React.SetStateAction<Selected>>;
};

export const HomeContext = createContext<HomeContextType | undefined>(undefined);

export function useHomeContext(): HomeContextType {
	const context = useContext(HomeContext);
	if (!context) {
		throw new Error("useHomeContext must be used within Games layout");
	}
	return context;
}
