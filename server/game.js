/** @format */

let players = [];
const sessionsmap = new Map();

async function postresult(p1_score, p2_score, p1_id, p2_id, winer, db) {
	const winnergold = 50;
	const losergold = 0;
	const date = new Date().toISOString();
	const player1_gold_earned = winer == 1 ? winnergold : losergold;
	const player2_gold_earned = winer == 2 ? winnergold : losergold;
	const winner_id = winer == 1 ? p1_id : p2_id;

	// console.log("📊 Posting game result:", { p1_id, p2_id, p1_score, p2_score, winner_id });

	// Insert game record into database
	db.run(
		`INSERT INTO games (date, player1_id, player2_id, player1_score, player2_score, player1_gold_earned, player2_gold_earned, winner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[date, p1_id, p2_id, p1_score, p2_score, player1_gold_earned, player2_gold_earned, winner_id],
		function (err) {
			if (err) {
				console.error("❌ Error inserting game:", err);
				return;
			}
			// console.log("✅ Game inserted with ID:", this.lastID);

			// Update player 1 stats
			db.run(
				`UPDATE users SET gold = gold + ?, games = games + 1, win = win + ?, lose = lose + ? WHERE id = ?`,
				[player1_gold_earned, winner_id == p1_id ? 1 : 0, winner_id == p2_id ? 1 : 0, p1_id],
				(err) => {
					if (err) console.error("❌ Error updating player 1 stats:", err);
					// else console.log("✅ Player 1 stats updated");
				}
			);

			// Update player 2 stats
			db.run(
				`UPDATE users SET gold = gold + ?, games = games + 1, win = win + ?, lose = lose + ? WHERE id = ?`,
				[player2_gold_earned, winner_id == p2_id ? 1 : 0, winner_id == p1_id ? 1 : 0, p2_id],
				(err) => {
					if (err) console.error("❌ Error updating player 2 stats:", err);
					// else console.log("✅ Player 2 stats updated");
				}
			);
		}
	);
}
function CalculateballVelocity(positions, angle) {
	let vx = 0.5;
	let vy = Math.sin(angle * (Math.PI / 180));
	const lenght = Math.sqrt(vx * vx + vy * vy);
	vx /= lenght;
	vy /= lenght;
	vx *= positions.direction * positions.speed;
	vy *= positions.direction * positions.speed;
	return { vx, vy };
}

function botmouvement(keysPressed, positions) {
	const intervalID = setInterval(() => {
		let pretectedposition = 50;
		let predectedtime = 100;
		let { ballx, bally, angle } = positions;

		if (positions.direction == 1) {
			let { vx, vy } = CalculateballVelocity(positions, angle);
			let directionchanged = false;
			while (ballx < 96) {
				if ((bally + vy <= 2 || bally + vy >= 98) && !directionchanged) {
					if (!angle) angle -= 5;
					angle *= -1;
					directionchanged = true;
				} else if (bally + vy > 2 && bally + vy < 98) directionchanged = false;
				ballx += vx;
				bally += vy;
				({ vx, vy } = CalculateballVelocity(positions, angle));
			}
			pretectedposition = bally;
		}

		const isup = pretectedposition < positions.p2;
		predectedtime = Math.abs(((pretectedposition - positions.p2) / 2.5) * 20);
		isup ? (keysPressed["botUp"] = true) : (keysPressed["botDown"] = true);
		setTimeout(() => {
			keysPressed["botUp"] = false;
			keysPressed["botDown"] = false;
		}, predectedtime);
	}, 1000);
	return intervalID;
}

function game(gametype, socket, keysPressed, session) {
	// const Curentplayer = players.find((p) => p.id == playerData.id);
	// console.log("cuuuuuuuurernt",Curentplayer);

	// if (gametype == "local" || gametype == "localvsbot") {
	// 	Curentplayer.startgame = 1;
	// 	if (gametype == "localvsbot")
	// 		Curentplayer.botInterval = botmouvement(
	// 			keysPressed,
	// 			session.positions
	// 		);
	// }

	// let post = 0;
	let Curentplayer;

	if (session.players_info.p1_id == socket.playerId) Curentplayer = 1;
	else {
		Curentplayer = 2;
	}

	const intervalId = setInterval(() => {
		// const player = players.find((p) => {
		// 	return p.id != Curentplayer.id && p.startgame == 0;
		// });

		// if (
		// 	player &&
		// 	Curentplayer.startgame == 0 &&
		// 	!Curentplayer.oponent &&
		// 	!player.startgame &&
		// 	!player.oponent &&
		// 	((!player.oppid && !Curentplayer.oppid) ||
		// 		(player.oppid == Curentplayer.id && Curentplayer.oppid == player.id))
		// ) {
		// 	player.oponent = Curentplayer;
		// 	Curentplayer.oponent = player;
		// 	Curentplayer.p1 = 1;

		// 	Curentplayer.oponent.positions.host = 1;
		// 	Curentplayer.startgame = 1;
		// 	socket.emit("oppid", { oppid: Curentplayer.oponent.id });
		// } else if (Curentplayer.oponent && Curentplayer.startgame == 0) {
		// 	Curentplayer.startgame = 1;
		// 	socket.emit("oppid", { oppid: Curentplayer.oponent.id });
		// }

		// if (
		// 	Curentplayer.oponent == null &&
		// 	Curentplayer.startgame == 1 &&
		// 	gametype == "online"
		// ) {
		// 	socket.emit("exit", { exit: 1 });
		// 	socket.disconnect();
		// 	return;
		// }

		// if (session.positions.win && Curentplayer.startgame) {
		// 	console.log("WIN");
		// if (Curentplayer.p1 == 1 && post == 0) {
		// 	console.log("POST");

		// 	postresult();
		// 	post = 1;
		// }

		// 	socket.emit("gameState", session.positions);
		// 	socket.disconnect();
		// 	return;
		// }
		if (session.p1_ready && session.p2_ready) session.startgame = 1;
		if (session.positions.win) {
			socket.emit("gameState", { ...session, Curentplayer: Curentplayer });
			socket.disconnect();
			// session.positions.win = 0;
		}
		if (session.startgame && !session.positions.win) {
			let { vx, vy } = CalculateballVelocity(
				session.positions,
				session.positions.angle
			);

			if (Curentplayer == 1) {
				if (keysPressed["w"] && session.positions.p1 - 10 - 2.5 >= 0)
					session.positions.p1 = session.positions.p1 - 2.5;
				if (keysPressed["s"] && 10 + session.positions.p1 + 2.5 <= 100)
					session.positions.p1 = session.positions.p1 + 2.5;
			}

			if (Curentplayer == 2) {
				if (keysPressed["w"] && session.positions.p2 - 10 - 2.5 >= 0)
					session.positions.p2 = session.positions.p2 - 2.5;
				if (keysPressed["s"] && 10 + session.positions.p2 + 2.5 <= 100)
					session.positions.p2 = session.positions.p2 + 2.5;
			}

			if (gametype == "local") {
				if (keysPressed["ArrowUp"] && session.positions.p2 - 2.5 - 10 >= 0)
					session.positions.p2 = session.positions.p2 - 2.5;
				if (keysPressed["ArrowDown"] && 10 + session.positions.p2 + 2.5 <= 100)
					session.positions.p2 = session.positions.p2 + 2.5;
			}

			if (gametype == "localvsbot") {
				if (keysPressed["botUp"] && session.positions.p2 - 2.5 - 10 >= 0)
					session.positions.p2 = session.positions.p2 - 2.5;
				if (keysPressed["botDown"] && 10 + session.positions.p2 + 2.5 <= 100)
					session.positions.p2 = session.positions.p2 + 2.5;
			}

			// if (gametype == "online") {
			// 	if (Curentplayer.p1 == 1) {
			// 		session.positions.p1 = Curentplayer.oponent.positions.p1;
			// 		session.positions.ballx = Curentplayer.oponent.positions.ballx;
			// 		session.positions.bally = Curentplayer.oponent.positions.bally;
			// 	} else {
			// 		session.positions.p2 = Curentplayer.oponent.positions.p2;
			// 	}
			// }

			if (session.positions.ballx <= 100 && session.positions.ballx + vx >= 0) {
				if (Curentplayer == 1) {
					if (
						session.positions.bally >= session.positions.p2 - 10 &&
						session.positions.bally <= session.positions.p2 + 10 &&
						session.positions.ballx + vx > 96
					) {
						let diff = (session.positions.bally - session.positions.p2) / 10;
						if (!diff) diff = 0.02;
						session.positions.direction = -1;
						session.positions.angle = diff * -75;
						session.positions.speed += 0.05;
					} else if (
						session.positions.bally >= session.positions.p1 - 10 &&
						session.positions.bally <= session.positions.p1 + 10 &&
						session.positions.ballx + vx < 4 &&
						session.positions.direction == -1
					) {
						let diff = (session.positions.bally - session.positions.p1) / 10;
						if (!diff) diff = 0.02;
						session.positions.direction = 1;
						session.positions.angle = diff * 75;
						session.positions.speed += 0.05;
					}

					if (
						(session.positions.bally + vy <= 2 ||
							session.positions.bally + vy >= 98) &&
						!session.positions.directionchanged
					) {
						if (!session.positions.angle) session.positions.angle -= 5;
						session.positions.angle *= -1;
						session.positions.directionchanged = true;
					} else if (
						session.positions.bally + vy > 2 &&
						session.positions.bally + vy < 98
					)
						session.positions.directionchanged = false;

					session.positions.ballx = session.positions.ballx + vx;
					session.positions.bally = session.positions.bally + vy;
				}
			} else {
				// if (Curentplayer == 1) {
				session.positions.direction == 1
					? session.positions.score.p1++
					: session.positions.score.p2++;
				// }

				// if (Curentplayer.oponent)
				// 	Curentplayer.oponent.positions.score = session.positions.score;

				if (
					(session.positions.score.p2 > 11 &&
						session.positions.score.p1 + 2 <= session.positions.score.p2) ||
					(session.positions.score.p1 > 11 &&
						session.positions.score.p2 + 2 <= session.positions.score.p1)
				) {
					session.positions.win = 2;
					if (session.positions.score.p1 > session.positions.score.p2)
						session.positions.win = 1;
					// console.log("WIN", Curentplayer, session);

					// if (Curentplayer.oponent != null) {
					// 	Curentplayer.oponent.positions.win =
					// 		-1 * session.positions.win;
					// }
				}

				session.positions.p1 = 50;
				session.positions.p2 = 50;
				session.positions.ballx = 50;
				session.positions.bally = 50;
				session.positions.angle = 0;
				session.positions.speed = 1;
			}
			// session.positions.Curentplayer = Curentplayer;
			socket.emit("gameState", { ...session, Curentplayer: Curentplayer });
			// if (session.positions.win && session.gametype != "online")
			// 	setTimeout(() => {
			// if(session.positions.win)
			// 	socket.disconnect();
			// 	}, 300);
			// If online and we have an opponent, send them the updated state
			// if (
			// 	gametype === "online" &&
			// 	Curentplayer.oponent &&
			// 	Curentplayer.oponent.socket
			// ) {
			// 	Curentplayer.oponent.socket.emit(
			// 		"gameState",
			// 		Curentplayer.oponent.positions
			// 	);
			// }
		}
	}, 20);

	// Curentplayer.intervalId = intervalId;
	return intervalId;
}

export function setupGameSocketIO(io, db) {
	const mainIo = io; // Store reference to main io instance
	io.of("/game").use((socket, next) => {
		const sessionId = socket.handshake.auth.sessionId;
		const playerId = socket.handshake.auth.playerId;
		// console.log(sessionsmap);

		const session = sessionsmap.get(sessionId);
		if (!session) return next(new Error("Invalid session ID"));
		if (
			session.players_info.p1_id != playerId &&
			session.players_info.p2_id != playerId
		) {
			return next(new Error("Player not authorized for this session"));
		}

		// Mark player as ready when connecting
		if (session.players_info.p1_id === playerId) {
			session.p1_ready = true;
		} else if (session.players_info.p2_id === playerId) {
			session.p2_ready = true;
		}

		socket.sessionId = sessionId;
		socket.playerId = playerId;
		socket.session = session;
		// console.log(session);

		next();
	});
	io.of("/game").on("connection", (socket) => {
		// console.log("Client connected to game namespace:", socket.id);
		const keysPressed = {};
		// let currentPlayerId = null;
		const session = socket.session;

		// socket.on("joinGame", (data) => {
		// const { gametype, oppid, id } = data;
		// currentPlayerId = id;
		// playerid = id;

		// if (currentPlayerId && oppid && currentPlayerId == oppid) {
		// 	socket.emit("exit", { exit: 1 });
		// 	return;
		// }
		// players_info: {
		// 					p1_id: player_id,
		// 					p2_id: 0,
		// 					p1_name: player_name,
		// 					p1_img: player_img,
		// 				},
		// 				p1_ready:true,
		// 				p2_ready:false,
		// 				gametype:game_type,
		// 				startgame:false,
		// 				positions:{}
		// Only set p2_ready for non-online games
		if (session.gametype != "online") session.p2_ready = true;
		
		let positions = {
			p1: 50,
			p2: 50,
			host: 0,
			ballx: 50,
			score: { p1: 0, p2: 0 },
			bally: 50,
			angle: 0,
			direction: 1,
			directionchanged: false,
			speed: 1,
			botrange: 70,
			win: 0,
		};
		session.positions = positions;
		// console.log(sessionsmap);
		if (session.gametype == "localvsbot")
			botmouvement(keysPressed, session.positions);

		const intervalID = game(session.gametype, socket, keysPressed, session);
		// const playeringame = players.find((p) => p.id == currentPlayerId);
		// if (!playeringame) {
		// const playerData = {
		// 	id: currentPlayerId,
		// 	socket: socket,
		// 	startgame: 0,
		// 	positions,
		// 	gametype,
		// 	oppid,
		// 	oponent: null,
		// 	p1: 0,
		// 	intervalId: null,
		// 	botInterval: null,
		// };

		// players.push(playerData);

		// Start the game loop
		// game(gametype, socket, keysPressed, playerData);
		// socket.emit("welcome", {
		// 	type: "welcome",
		// 	message: "Welcome to the game",
		// });
		// } else {
		// 	socket.emit("exit", { exit: 1 });
		// 	return;
		// }
		// });

		socket.on("keydown", (data) => {
			keysPressed[data.key] = true;
		});

		socket.on("keyup", (data) => {
			keysPressed[data.key] = false;
		});

		// Handle exit from waiting screen
		socket.on("exit_waiting", () => {
			// console.log("🚪 Player exiting from waiting screen:", socket.playerId);
			
			// If host is exiting a private game invite, notify the invited player
			if (session.gametype === "online" && 
					socket.playerId == session.players_info.p1_id && 
					session.players_info.p2_id !== 0) {
				// console.log(`🧹 Host canceling invite - removing notification for player ${session.players_info.p2_id}`);
				db.run(
					`DELETE FROM notifications WHERE type = 'game_invite' AND sender_id = ? AND user_id = ?`,
					[session.players_info.p1_id, session.players_info.p2_id],
					(err) => {
						if (!err) {
							mainIo.to(`user:${session.players_info.p2_id}`).emit("game_invite_expired", {
								senderId: session.players_info.p1_id
							});
						}
					}
				);
			}
			
			// Clean up session
			clearInterval(intervalID);
			sessionsmap.delete(socket.sessionId);
			// console.log("🗑️ Session deleted (exit waiting):", socket.sessionId);
			
			// Disconnect the socket
			socket.disconnect();
		});

		socket.on("disconnect", () => {
			// console.log("Client disconnected from game:", socket.id);
			
			// If game hasn't started (still in loading), clean up without counting as loss
			if (!session.startgame && session.gametype === "online") {
				// console.log("🔄 Player disconnected during loading phase");
				
				// If host (p1) disconnects during loading, notify invited player
				if (socket.playerId == session.players_info.p1_id && session.players_info.p2_id !== 0) {
					// console.log(`📣 Host left during loading - notifying player ${session.players_info.p2_id}`);
					db.run(
						`DELETE FROM notifications WHERE type = 'game_invite' AND sender_id = ? AND user_id = ?`,
						[session.players_info.p1_id, session.players_info.p2_id],
						(err) => {
							if (!err) {
								mainIo.to(`user:${session.players_info.p2_id}`).emit("game_invite_expired", {
									senderId: session.players_info.p1_id
								});
							}
						}
					);
				}
				
				// Clean up session immediately
				clearInterval(intervalID);
				sessionsmap.delete(socket.sessionId);
				// console.log("🗑️ Session deleted (loading phase):", socket.sessionId);
				return;
			}
			
			// All disconnects after game starts count as loss
			if (
				socket.session.positions.win == 0 &&
				socket.playerId == socket.session.players_info.p1_id
			) {
				// Host (p1) disconnected - they lose, but DON'T remove notification
				socket.session.positions.win = 2;
				session.positions.score.p1 = 0;
				session.positions.score.p2 = 12;
				// console.log("🎮 Host (P1) disconnected - P2 wins, notification kept");
			} else if (
				socket.session.positions.win == 0 &&
				socket.playerId == socket.session.players_info.p2_id
			) {
				// Invited player (p2) disconnected - they lose, REMOVE notification
				socket.session.positions.win = 1;
				session.positions.score.p1 = 12;
				session.positions.score.p2 = 0;
				
				// Clean up game invite notification when invited player exits
				if (session.gametype === "online" && session.players_info.p2_id && session.players_info.p1_id) {
					// console.log(`🧹 Invited player (P2) disconnected - removing notification for player ${session.players_info.p2_id}`);
					db.run(
						`DELETE FROM notifications WHERE type = 'game_invite' AND sender_id = ? AND user_id = ?`,
						[session.players_info.p1_id, session.players_info.p2_id],
						(err) => {
							if (err) {
								console.error("❌ Error deleting notification:", err);
							} else {
								// Notify that the invitation is no longer valid
								mainIo.to(`user:${session.players_info.p2_id}`).emit("game_invite_expired", {
									senderId: session.players_info.p1_id
								});
							}
						}
					);
				}
				// console.log("🎮 Invited player (P2) disconnected - P1 wins, notification removed");
			}
			
			// Post result if online game ended
			if (
				socket.playerId == socket.session.players_info.p2_id &&
				session.gametype == "online" &&
				session.positions.win != 0
			) {
				postresult(
					session.positions.score.p1,
					session.positions.score.p2,
					session.players_info.p1_id,
					session.players_info.p2_id,
					session.positions.win,
					db
				);
			}
			
			// Clean up session and interval
			clearInterval(intervalID);
			setTimeout(() => {
				sessionsmap.delete(socket.sessionId);
				// console.log("🗑️ Session deleted:", socket.sessionId);
			}, 100);

			// if (currentPlayerId) {
			// 	const playerIndex = players.findIndex((p) => p.id === currentPlayerId);
			// 	if (playerIndex !== -1) {
			// 		const player = players[playerIndex];

			// 		// Clear intervals
			// 		if (player.intervalId) clearInterval(player.intervalId);
			// 		if (player.botInterval) clearInterval(player.botInterval);

			// 		// Handle opponent cleanup
			// 		if (player.oponent) {
			// 			player.oponent.oponent = null;
			// 			if (player.oponent.socket) {
			// 				player.oponent.socket.emit("opponentDisconnected");
			// 			}
			// 		}

			// 		// Remove player from array
			// 		players.splice(playerIndex, 1);
			// 	}
			// }
		});
	});
}
export { sessionsmap };
export default { setupGameSocketIO };