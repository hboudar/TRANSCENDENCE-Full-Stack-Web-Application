
/** @format */

"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Loading from "@/app/components/loading";
import { useHomeContext } from "../context";
import { io, Socket } from "socket.io-client";
import Tournament from "@/app/components/Tournament";
import WinAnimation from "@/app/components/WinAnimation";
import LoseAnimation from "@/app/components/LoseAnimation";
import LocalGameWinAnimation from "@/app/components/LocalGameWinAnimation";
import { Suspense } from "react";
import { showAlert } from "@/app/components/Alert";

// Extend Window interface for game-specific properties
declare global {
	interface Window {
		gameSocket?: Socket;
		emitKey?: (key: string, action: "keydown" | "keyup") => void;
	}
}

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

type Score = { p1: number; p2: number };
type PositionsType = {
	score?: Score;
	p1?: number;
	p2?: number;
	bally?: number;
	ballx?: number;
	Curentplayer?: 1 | 2;
	win?: 0 | 1 | 2;
};

type PlayersData = {
	p1_name: string;
	p1_img: string;
	p1_id?: string | number;
	p2_name: string;
	p2_img: string;
	p2_id?: string | number;
};

type TournamentPlayers = {
	p1?: string;
	p1_id?: string | number;
	p2?: string;
	p2_id?: string | number;
	winer?: number;
	gamestatus?: number;
};

function GameContent() {
	const { user } = useHomeContext();
	const [selected, setselected] = useState<Selected>({ types: [], type: 0 });
	const router = useRouter();
	const [Positions, setPositions] = useState<PositionsType>({});
	const [tournamentplayers, settournamentplayers] = useState<TournamentPlayers>(
		{
			p1: "",
			p1_id: 0,
			p2: "",
			p2_id: 0,
			winer: 0,
			gamestatus: 0,
		}
	);

	const [playersdata, setplayersdata] = useState<PlayersData>({
		p1_name: "Player 1",
		p1_img: "",
		p2_name: "Player 1",
		p2_img: "",
	});
	const [showWinAnimation, setShowWinAnimation] = useState(false);
	const [winnerData, setWinnerData] = useState<{
		name: string;
		img: string;
		id?: string | number;
	} | null>(null);
	const [alreadyInGame, setAlreadyInGame] = useState(false);
	const [sessionNotFound, setSessionNotFound] = useState(false);
	const [isWaitingForPlayer, setIsWaitingForPlayer] = useState(false);
	const [canExit, setCanExit] = useState(false);
	const isInitializing = useRef(false);
	const socketRef = useRef<Socket | null>(null);
	const tournamentTransitionScheduled = useRef(false);
	const isTournamentTransitioning = useRef(false);

	const serchParams = useSearchParams();
	const [gametype, setgametype] = useState<string | null>(
		serchParams.get("gametype")
	);
	let oppid = Number(serchParams.get("oppid"));
	const invited_player = serchParams.get("invited_player");
	if (!oppid) oppid = 0;

	// Validate game type on mount
	useEffect(() => {
		const validGameTypes = ["localvsbot", "local", "online", "tournament", "localvsbot"];
		if (gametype && !validGameTypes.includes(gametype)) {
			console.error("Invalid game type:", gametype);
			router.push("/games");
		}
	}, [gametype, router]);

	useEffect(() => {
		// console.log(gametype, Positions, tournamentplayers);

		if (gametype == "tournament" && tournamentplayers.gamestatus == 1) {
			// console.log("touuurlocal");

			setgametype("local");
			return;
		}
		if (!user || gametype == "tournament") return;
		
		// Check if this is a private game reload (host reloading while waiting)
		// Use sessionStorage flag to distinguish fresh invite from reload
		if (gametype === "online" && oppid && oppid !== 0 && !invited_player) {
			const isIntentionalInvite = sessionStorage.getItem('creatingPrivateGame');
			
			if (!isIntentionalInvite) {
				// This is a reload, not a fresh invite - redirect to chat
				console.log("Private game reload detected - redirecting to chat");
				router.push("/chat");
				return;
			}
			
			// Clear the flag after checking - it's only valid for initial load
			sessionStorage.removeItem('creatingPrivateGame');
		}
		
		async function newgame() {
			// Prevent duplicate initialization in React Strict Mode (dev mode)
			if (isInitializing.current) {
				console.log("Game already initializing, skipping duplicate request");
				return;
			}

			isInitializing.current = true;

			try {
				// Check for blocks if it's an online game with specific opponent
				if (gametype === "online" && oppid && oppid !== 0) {
					const blockCheckRes = await fetch(`/api/blocks/check/${user.id}/${oppid}`);
					const blockData = await blockCheckRes.json();
					
					if (blockData.blocked) {
						console.log("Cannot start game - users have blocked each other");
						showAlert(
							blockData.is_blocker 
								? "You cannot play with a user you have blocked. Please unblock them first."
								: "This user has blocked you. You cannot play with them.",
							'error'
						);
						router.push("/chat");
						isInitializing.current = false;
						return;
					}
				}

				const sessionid = crypto.randomUUID();

				const response = await fetch("/api/games/start", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
				body: JSON.stringify({
					player2_id: oppid,
					invited_player: invited_player ? true : false,
					player2_name: tournamentplayers.p2
						? tournamentplayers.p2
						: "Player 2",
					game_type: gametype,
					sessionId: sessionid,
				}),
				});
				const res = await response.json();
				console.log(res);

				if (res.sessionNotFound == true) {
					console.log("No game session found for invited player");
					setSessionNotFound(true);
					setTimeout(() => {
						router.push("/games");
					}, 5000);
					isInitializing.current = false;
					return;
				}

				if (res.alreadyInGame == true) {
					console.log("Player is already in an active game");
					isInitializing.current = false;

					setAlreadyInGame(true);
					setTimeout(() => {
						router.push("/games");
					}, 5000);
					return;
				}
				if (response.ok) {
					let socket: Socket | null = null;

					if (typeof window !== "undefined") {
						socket = io(`${window.location.origin}/game`, {
							path: "/socket.io",
							transports: ["websocket", "polling"],
							auth: {
								sessionId: res.sessionId,
								playerId: user!.id,
							},
						});
					}

					if (!socket) return;
					socketRef.current = socket;

					socket.on("gameState", (data) => {
						setplayersdata(data.players_info as PlayersData);
						setPositions({
							...data.positions,
							Curentplayer: data.Curentplayer,
						} as PositionsType);

						// Check if waiting for player 2
						if (gametype === "online" && data.players_info.p2_id === 0) {
							setIsWaitingForPlayer(true);
							setCanExit(true);
						} else {
							setIsWaitingForPlayer(false);
							setCanExit(false);
						}

						// Handle game end with animation
						if (data.positions.win !== 0) {
							// Determine winner
							const winner =
								data.positions.win === 1
									? {
											name: data.players_info.p1_name,
											img: data.players_info.p1_img,
											id: data.players_info.p1_id,
									  }
									: {
											name: data.players_info.p2_name,
											img: data.players_info.p2_img,
											id: data.players_info.p2_id,
									  };
							console.log(winner);
							
							setWinnerData(winner);
							setShowWinAnimation(true);

							// Clear session and disconnect after animation
							setTimeout(() => {
								sessionStorage.removeItem("gameSessionId");
								socket.disconnect();
							}, 4000);
						}
					});

					// Handle server-initiated disconnect
					socket.on("disconnect", (reason) => {
						console.log("Socket disconnected:", reason);
						sessionStorage.removeItem("gameSessionId");
						isInitializing.current = false;
					});

					// Helper function to emit key events
					const emitKey = (key: string, action: "keydown" | "keyup") => {
						socket.emit(action, { key });
					};

					function handleKeyDown(event: KeyboardEvent) {
						let key = event.key;
						// Map mobile keys to game keys
						if (key === "a") key = "w";
						if (key === "d") key = "s";
						if (key === "ArrowLeft") key = "ArrowUp";
						if (key === "ArrowRight") key = "ArrowDown";

						if (
							key === "w" ||
							key === "s" ||
							key === "ArrowUp" ||
							key === "ArrowDown"
						) {
							emitKey(key, "keydown");
						}
					}

					function handleKeyUp(event: KeyboardEvent) {
						let key = event.key;
						// Map mobile keys to game keys
						if (key === "a") key = "w";
						if (key === "d") key = "s";
						if (key === "ArrowLeft") key = "ArrowUp";
						if (key === "ArrowRight") key = "ArrowDown";

						if (
							key === "w" ||
							key === "s" ||
							key === "ArrowUp" ||
							key === "ArrowDown"
						) {
							emitKey(key, "keyup");
						}
					}

					window.gameSocket = socket;
					window.emitKey = emitKey;

					// Handle intentional navigation away (back button, route change)
					const handleRouteChange = () => {
						isInitializing.current = false;
						if (socket) {
							socket.disconnect();
						}
					};

					// Don't remove session on page reload (beforeunload)
					// Session will be kept for reconnection
					window.addEventListener("popstate", handleRouteChange);

					document.addEventListener("keydown", handleKeyDown);
					document.addEventListener("keyup", handleKeyUp);

					return () => {
						window.removeEventListener("popstate", handleRouteChange);
						document.removeEventListener("keydown", handleKeyDown);
						document.removeEventListener("keyup", handleKeyUp);
						delete window.gameSocket;
						delete window.emitKey;
						
						// Cleanup on unmount
						isInitializing.current = false;
						if (socket) socket.disconnect();
					};
				} else {
					console.log(res.error);
					isInitializing.current = false;
				}
			} catch (error) {
				console.log(error);
				isInitializing.current = false;
			}
		}
		const cleanup = newgame() as unknown as (() => void) | undefined;
		return () => {
			if (cleanup && typeof cleanup === "function") {
				cleanup();
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [gametype, tournamentplayers.gamestatus, invited_player, oppid, user]);

	useEffect(() => {
		async function fetchSkin() {
			try {
				const res = await fetch(
					`/api/selected_skins?player_id=${user!.id}`
				);
				const data = await res.json();
				setselected({ types: data, type: 0 });
			} catch (err) {
				console.error("Error fetching skin:", err);
			}
		}
		if (user) {
			fetchSkin();
		}
	}, [user, setselected]);
	async function tournamentstates() {
		// console.log("tournament win", playersdata, Positions, tournamentplayers);

		// Clear win animation states before transitioning
		setShowWinAnimation(false);
		setWinnerData(null);
		setPositions({});
		setgametype("tournament");
		settournamentplayers({
			...tournamentplayers,
			gamestatus: 0,
			winer: (Positions.win as number) || 0,
		});
	}

	const handleExitWaiting = () => {
		if (socketRef.current) {
			// Notify server to clean up session and notifications
			socketRef.current.emit("exit_waiting");
			// Give server time to process before disconnecting
			setTimeout(() => {
				if (socketRef.current) {
					socketRef.current.disconnect();
					socketRef.current = null;
				}
				// If it's a private game (has oppid), go back to chat, otherwise go to games
				if (oppid && oppid !== 0) {
					router.push("/chat");
				} else {
					router.push("/games");
				}
			}, 100);
		} else {
			// If it's a private game (has oppid), go back to chat, otherwise go to games
			if (oppid && oppid !== 0) {
				router.push("/chat");
			} else {
				router.push("/games");
			}
		}
	};

	// Show session not found message
	if (sessionNotFound) {
		return (
			<div className="bg-gray-400/30 backdrop-blur-sm flex flex-col justify-center items-center z-50 absolute top-0 bottom-0 left-0 right-0">
				<div className="bg-gradient-to-b from-gray-800 to-gray-900 p-8 rounded-2xl text-center max-w-md border-2 border-red-500/50 shadow-2xl">
					<div className="text-7xl mb-6 animate-bounce">❌</div>
					<h2 className="text-3xl font-bold mb-4 text-red-400">
						Session Expired
					</h2>
					<p className="text-lg mb-4 text-gray-300">
						The game session no longer exists.
					</p>
					<p className="text-sm mb-6 text-gray-400">
						The host may have disconnected or the invitation expired.
					</p>
					<div className="flex items-center justify-center gap-2 text-blue-400">
						<svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
							<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<span className="text-sm">Redirecting to games...</span>
					</div>
				</div>
			</div>
		);
	}

	// Show already in game message
	if (alreadyInGame) {
		return (
			<div className="bg-gray-400/30 backdrop-blur-sm flex flex-col justify-center items-center z-50 absolute top-0 bottom-0 left-0 right-0">
				<div className="bg-gray-800 p-8 rounded-lg text-center max-w-md border-2 border-yellow-500">
					<div className="text-6xl mb-6">⚠️</div>
					<h2 className="text-3xl font-bold mb-4 text-yellow-500">
						Game Already In Progress
					</h2>
					<p className="text-lg mb-6 text-gray-300">
						You already have a game session active. Please finish or exit that
						game first.
					</p>
					<p className="text-sm text-gray-400">Redirecting to games...</p>
				</div>
			</div>
		);
	}

	if (gametype == "tournament") {
		if (
			!tournamentplayers.p1 ||
			!tournamentplayers.p1_id ||
			!tournamentplayers.p2 ||
			!tournamentplayers.p2_id ||
			!tournamentplayers.gamestatus
		) {
			return (
				<Tournament
					settournamentplayers={settournamentplayers}
					tournamentplayers={tournamentplayers}></Tournament>
			);
		}
	}
	if (!Positions.score || !selected.types || !selected.types[0]) {
		return (
			<div className="bg-gray-400/30 backdrop-blur-sm flex flex-col justify-center items-center z-50  absolute top-0 bottom-0 left-0 right-0   ">
				<Loading />
				<button
					onClick={handleExitWaiting}
					className="absolute top-4 left-4 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
				>
					{isWaitingForPlayer && canExit ? 'Exit Waiting' : 'Back to Games'}
				</button>
				{isWaitingForPlayer && canExit && (
					<p className="text-white text-lg animate-pulse mt-8">Waiting for opponent to join...</p>
				)}
			</div>
		);
	}

	if (Positions.win != 0) {
		if (tournamentplayers.p1_id != 0 && tournamentplayers.winer == 0) {
			// Tournament game ended - no animation for individual matches
			if (
				tournamentplayers.p1 != playersdata.p1_name ||
				tournamentplayers.p2 != playersdata.p2_name
			) {
				setgametype("local");
				setPositions({});
				return;
			}

			// Schedule tournament state change immediately (no animation delay)
			if (!tournamentTransitionScheduled.current) {
				tournamentTransitionScheduled.current = true;
				isTournamentTransitioning.current = true;
				setTimeout(() => {
					tournamentstates();
					tournamentTransitionScheduled.current = false;
					isTournamentTransitioning.current = false;
				}, 100); // Quick transition back to tournament screen
			}

			// Don't show animation for individual tournament matches
			// Animation only shown when entire tournament is won
			return (
				<div className="bg-gray-400/30 backdrop-blur-sm flex flex-col justify-center items-center z-50 absolute top-0 bottom-0 left-0 right-0">
					<Loading />
				</div>
			);
		} else if (!showWinAnimation) {
			setTimeout(() => {
				router.push("/games");
			}, 4000);

			const winner =
				Positions.win === 1
					? {
							name: playersdata.p1_name,
							img: playersdata.p1_img,
							id: playersdata.p1_id,
					  }
					: {
							name: playersdata.p2_name,
							img: playersdata.p2_img,
							id: playersdata.p2_id,
					  };

			if (gametype === "local") {
				// Local game - just show the winner
				return (
					<LocalGameWinAnimation
						winnerName={winner.name}
						winnerImg={winner.img}
					/>
				);
			}else if(gametype === "online"){
				const isPlayer1Winner = winner.id === user!.id;
				
				if (!isPlayer1Winner) {
					// Player 1 lost - show lose animation
					return <LoseAnimation />;
				} else {
					// Player 1 won - show victory animation
					return (
						<WinAnimation
							winnerName={winner.name}
							winnerImg={winner.img}
						/>
					);
				}
			 } else {
				// Online game - show win or lose based on player 1 result
				const isPlayer1Lose = Positions.win === 2;

				if (isPlayer1Lose) {
					// Player 1 lost - show lose animation
					return <LoseAnimation />;
				} else {
					// Player 1 won - show victory animation
					return (
						<WinAnimation
							winnerName={winner.name}
							winnerImg={winner.img}
						/>
					);
				}
			}
		}
	}

	// Show win animation overlay if active (triggered by socket event)
	if (showWinAnimation && winnerData) {
		setTimeout(() => {
			router.push("/games");
		}, 4000);

		if (gametype === "local") {
			// Local game - just show the winner
			return (
				<LocalGameWinAnimation
					winnerName={winnerData.name}
					winnerImg={winnerData.img}
				/>
			);
		}else if(gametype === "online"){
			const isPlayer1Winner = winnerData.id === user!.id;
			if (!isPlayer1Winner) {
				// Player 1 lost - show lose animation
				return <LoseAnimation />;
			} else {
				// Player 1 won - show victory animation
				return (
					<WinAnimation
						winnerName={winnerData.name}
						winnerImg={winnerData.img}
					/>
				);
			}
			 }  else {
			// Online game - check if current player (player 1) is the winner
			const isPlayer1Winner = winnerData.name === playersdata.p1_name;

			if (!isPlayer1Winner) {
				// Player 1 lost - show lose animation
				return <LoseAnimation />;
			} else {
				// Player 1 won - show victory animation
				return (
					<WinAnimation
						winnerName={winnerData.name}
						winnerImg={winnerData.img}
					/>
				);
			}
		}
	}

	// Button control handlers
	const handleButtonPress = (key: string) => {
		const emitKey = window.emitKey;
		if (emitKey) {
			emitKey(key, "keydown");
		}
	};

	const handleButtonRelease = (key: string) => {
		const emitKey = window.emitKey;
		if (emitKey) {
			emitKey(key, "keyup");
		}
	};

	return (
		<div className="bg-gray-400/30 backdrop-blur-sm flex justify-center items-center z-50  absolute top-0 bottom-0 left-0 right-0 p-4">
			<div className="flex flex-col gap-5 w-full h-full max-w-7xl">
				{/* Score and player info bar (always on top, not rotated) */}
				<div className="flex items-center justify-between px-2 md:px-5 mb-4">
					<div className="flex items-center gap-2 md:gap-5">
						<div className="rounded-full w-10 h-10 md:w-14 md:h-14 overflow-hidden border">
							{/* <img
								className="w-full h-full object-cover object-center"
								src={
									"/" +
									(Positions.Curentplayer == 1
										? playersdata.p1_img
										: playersdata.p2_img)
								}
								width={60}
								height={60}
								alt="profile"></Image> */}
							<img
								src={
									Positions.Curentplayer == 1
										? playersdata.p1_img
										: playersdata.p2_img
								}
								alt="profile"></img>
						</div>
						<p className="text-sm md:text-base">
							{Positions.Curentplayer == 1
								? playersdata.p1_name
								: playersdata.p2_name}
						</p>
					</div>
					<div className="text-lg md:text-xl font-bold">{`${
						Positions.Curentplayer == 1
							? Positions.score?.p1
							: Positions.score?.p2
					} - ${
						Positions.Curentplayer == 1
							? Positions.score?.p2
							: Positions.score?.p1
					}`}</div>
					<div className="flex items-center gap-2 md:gap-5">
						<p className="text-sm md:text-base">
							{Positions.Curentplayer == 1
								? playersdata.p2_name
								: playersdata.p1_name}
						</p>
						<div className="rounded-full w-10 h-10 md:w-14 md:h-14 overflow-hidden border">
							{/* <img
								className="w-full h-full object-cover object-center"
								src={
									"/" +
									(Positions.Curentplayer == 1
										? playersdata.p2_img
										: playersdata.p1_img)
								}
								width={60}
								height={60}
								alt="profile"></Image> */}
							<img
								src={
									Positions.Curentplayer == 1
										? playersdata.p2_img
										: playersdata.p1_img
								}
								alt="profile"></img>
						</div>
					</div>
				</div>

				{/* Rotated game area and buttons container */}
				<div className="flex max-md:-rotate-90 flex-1 min-h-0 items-center justify-center w-full  gap-5">
					{/* Player 1 Controls (left on desktop, bottom on mobile after rotation) */}
					<div className="flex flex-col justify-center items-center gap-3">
						<button
							onTouchStart={() => handleButtonPress("w")}
							onTouchEnd={() => handleButtonRelease("w")}
							onMouseDown={() => handleButtonPress("w")}
							onMouseUp={() => handleButtonRelease("w")}
							onMouseLeave={() => handleButtonRelease("w")}
							className="w-20 h-20 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-2xl touch-none select-none">
							↑
						</button>
						<button
							onTouchStart={() => handleButtonPress("s")}
							onTouchEnd={() => handleButtonRelease("s")}
							onMouseDown={() => handleButtonPress("s")}
							onMouseUp={() => handleButtonRelease("s")}
							onMouseLeave={() => handleButtonRelease("s")}
							className="w-20 h-20 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-2xl touch-none select-none">
							↓
						</button>
					</div>

					{/* Game Table */}
					<div className="flex-1 flex items-center justify-center">
						<div
							id="table"
							style={{
								background: selected.types[0].color,
							}}
							className={`relative ${
								Positions.Curentplayer == 2 && `transform -scale-x-100`
							} bg-[#252525] flex justify-center border-4 rounded-2xl 
							w-full min-md:max-w-3xl max-md:w-[60vh] aspect-[9/5]
							`}>
							<div className="border border-dashed h-full"></div>
							<div
								id="padle1"
								className="h-1/5 -translate-y-1/2 aspect-[1/6] rounded-full bg-[#fff] absolute left-1"
								style={{
									top: `${Positions.p1}%`,
									background: selected.types[1].color,
								}}></div>
							<div
								id="padle2"
								className="h-1/5 -translate-y-1/2 aspect-[1/6] rounded-full bg-green-700 absolute right-1"
								style={{
									top: `${Positions.p2}%`,
									background: selected.types[1].color,
								}}></div>
							<div
								id="ball"
								style={{
									top: `${Positions.bally}%`,
									left: `${Positions.ballx}%`,
									background: selected.types[2].color,
								}}
								className="bg-[#c7c7c7] h-[4%] -translate-1/2 aspect-square rounded-full absolute"></div>
						</div>
					</div>

					{/* Player 2 Controls (right on desktop, top on mobile after rotation) */}
					{gametype === "local" && (
						<div className="flex flex-col justify-center items-center gap-3">
							<button
								onTouchStart={() => handleButtonPress("ArrowUp")}
								onTouchEnd={() => handleButtonRelease("ArrowUp")}
								onMouseDown={() => handleButtonPress("ArrowUp")}
								onMouseUp={() => handleButtonRelease("ArrowUp")}
								onMouseLeave={() => handleButtonRelease("ArrowUp")}
								className="w-20 h-20 bg-green-500 hover:bg-green-600 active:bg-green-700 rounded-lg flex items-center justify-center text-white font-bold text-2xl touch-none select-none">
								↑
							</button>
							<button
								onTouchStart={() => handleButtonPress("ArrowDown")}
								onTouchEnd={() => handleButtonRelease("ArrowDown")}
								onMouseDown={() => handleButtonPress("ArrowDown")}
								onMouseUp={() => handleButtonRelease("ArrowDown")}
								onMouseLeave={() => handleButtonRelease("ArrowDown")}
								className="w-20 h-20 bg-green-500 hover:bg-green-600 active:bg-green-700 rounded-lg flex items-center justify-center text-white font-bold text-2xl touch-none select-none">
								↓
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default function Game() {
	return (
		<Suspense fallback={
			<div className="bg-gray-400/30 backdrop-blur-sm flex flex-col justify-center items-center z-50  absolute top-0 bottom-0 left-0 right-0   ">
				<Loading />
			</div>
		}>
			<GameContent />
		</Suspense>
	);
}
