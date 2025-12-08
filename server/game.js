

import jwt from 'jsonwebtoken';
const SECRET = process.env.JWT_SECRET;

let players = [];
const sessionsmap = new Map();

async function postresult(p1_score, p2_score, p1_id, p2_id, winer, db) {
	const winnergold = 50;
	const losergold = 0;
	const date = new Date().toISOString();
	const player1_gold_earned = winer == 1 ? winnergold : losergold;
	const player2_gold_earned = winer == 2 ? winnergold : losergold;
	const winner_id = winer == 1 ? p1_id : p2_id;

	

	
	db.run(
		`INSERT INTO games (date, player1_id, player2_id, player1_score, player2_score, player1_gold_earned, player2_gold_earned, winner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[date, p1_id, p2_id, p1_score, p2_score, player1_gold_earned, player2_gold_earned, winner_id],
		function (err) {
			if (err) {
				console.error("❌ Error inserting game:", err);
				return;
			}
			

			
			db.run(
				`UPDATE users SET gold = gold + ?, games = games + 1, win = win + ?, lose = lose + ? WHERE id = ?`,
				[player1_gold_earned, winner_id == p1_id ? 1 : 0, winner_id == p2_id ? 1 : 0, p1_id],
				(err) => {
					if (err) console.error("❌ Error updating player 1 stats:", err);
					
				}
			);

			
			db.run(
				`UPDATE users SET gold = gold + ?, games = games + 1, win = win + ?, lose = lose + ? WHERE id = ?`,
				[player2_gold_earned, winner_id == p2_id ? 1 : 0, winner_id == p1_id ? 1 : 0, p2_id],
				(err) => {
					if (err) console.error("❌ Error updating player 2 stats:", err);
					
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
	
	

	
	
	
	
	
	
	
	

	
	let Curentplayer;

	if (session.players_info.p1_id == socket.playerId) Curentplayer = 1;
	else {
		Curentplayer = 2;
	}

	const intervalId = setInterval(() => {
		
		
		

		
		
		
		
		
		
		
		
		
		
		
		

		
		
		
		
		
		
		

		
		
		
		
		
		
		
		
		

		
		
		
		

		
		
		

		
		
		
		
		if (session.p1_ready && session.p2_ready) session.startgame = 1;
		if (session.positions.win) {
			socket.emit("gameState", { ...session, Curentplayer: Curentplayer });
			socket.disconnect();
			
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
				
				session.positions.direction == 1
					? session.positions.score.p1++
					: session.positions.score.p2++;
				

				
				

				if (
					(session.positions.score.p2 > 11 &&
						session.positions.score.p1 + 2 <= session.positions.score.p2) ||
					(session.positions.score.p1 > 11 &&
						session.positions.score.p2 + 2 <= session.positions.score.p1)
				) {
					session.positions.win = 2;
					if (session.positions.score.p1 > session.positions.score.p2)
						session.positions.win = 1;
					

					
					
					
					
				}

				session.positions.p1 = 50;
				session.positions.p2 = 50;
				session.positions.ballx = 50;
				session.positions.bally = 50;
				session.positions.angle = 0;
				session.positions.speed = 1;
			}
			
			socket.emit("gameState", { ...session, Curentplayer: Curentplayer });
			
			
			
			
			
			
			
			
			
			
			
			
			
			
			
			
		}
	}, 20);

	
	return intervalId;
}

export function setupGameSocketIO(io, db) {
	const mainIo = io; 
	io.of("/game").use((socket, next) => {
		try {
			
			const token = socket.handshake.auth.token || 
			              socket.handshake.headers.cookie?.match(/token=([^;]+)/)?.[1];
			
			if (!token) {
				console.log('⚠️ Game connection rejected: No token');
				return next(new Error('Authentication required'));
			}
			
			
			db.get('SELECT token FROM blacklist_tokens WHERE token = ?', [token], (err, blacklisted) => {
				if (err || blacklisted) {
					console.log('⚠️ Game connection rejected: Token blacklisted');
					return next(new Error('Token has been revoked'));
				}
				
				
				let decoded;
				try {
					decoded = jwt.verify(token, SECRET);
				} catch (jwtError) {
					console.log('⚠️ Game connection rejected: Invalid token');
					return next(new Error('Invalid or expired token'));
				}
				
				const authenticatedUserId = decoded.userId;
				
				
				db.get('SELECT id FROM users WHERE id = ?', [authenticatedUserId], (err, user) => {
					if (err || !user) {
						console.log(`⚠️ Game connection rejected: User ${authenticatedUserId} not found`);
						return next(new Error('User not found'));
					}
					
					const sessionId = socket.handshake.auth.sessionId;
					const playerId = socket.handshake.auth.playerId;
					
					
					if (authenticatedUserId != playerId) {
						console.log(`🚫 Game connection rejected: User ${authenticatedUserId} attempted to play as ${playerId}`);
						return next(new Error('Cannot play as another user'));
					}

					const session = sessionsmap.get(sessionId);
					if (!session) return next(new Error("Invalid session ID"));
					if (
						session.players_info.p1_id != playerId &&
						session.players_info.p2_id != playerId
					) {
						return next(new Error("Player not authorized for this session"));
					}

					
					if (session.players_info.p1_id === playerId) {
						session.p1_ready = true;
					} else if (session.players_info.p2_id === playerId) {
						session.p2_ready = true;
					}

					socket.sessionId = sessionId;
					socket.playerId = playerId;
					socket.session = session;
					console.log(`✅ Game authenticated: User ${authenticatedUserId} for session ${sessionId}`);

					next();
				});
			});
		} catch (error) {
			console.log('⚠️ Game connection rejected:', error.message);
			next(new Error('Authentication failed'));
		}
	});
	io.of("/game").on("connection", (socket) => {
		
		const keysPressed = {};
		
		const session = socket.session;

		
		
		
		

		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
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
		
		if (session.gametype == "localvsbot")
			botmouvement(keysPressed, session.positions);

		const intervalID = game(session.gametype, socket, keysPressed, session);
		
		
		
		
		
		
		
		
		
		
		
		
		
		

		

		
		
		
		
		
		
		
		
		
		
		

		socket.on("keydown", (data) => {
			
			if (!data || !data.key || typeof data.key !== 'string') {
				console.log('🚫 Invalid keydown data');
				return;
			}
			
			const validKeys = ['w', 's', 'ArrowUp', 'ArrowDown'];
			if (!validKeys.includes(data.key)) {
				console.log(`🚫 Invalid game key: ${data.key}`);
				return;
			}
			keysPressed[data.key] = true;
		});

		socket.on("keyup", (data) => {
			
			if (!data || !data.key || typeof data.key !== 'string') {
				console.log('🚫 Invalid keyup data');
				return;
			}
			
			const validKeys = ['w', 's', 'ArrowUp', 'ArrowDown'];
			if (!validKeys.includes(data.key)) {
				console.log(`🚫 Invalid game key: ${data.key}`);
				return;
			}
			keysPressed[data.key] = false;
		});

		
		socket.on("exit_waiting", () => {
			
			
			
			if (session.gametype === "online" && 
					socket.playerId == session.players_info.p1_id && 
					session.players_info.p2_id !== 0) {
				
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
			
			
			clearInterval(intervalID);
			sessionsmap.delete(socket.sessionId);
			
			
			
			socket.disconnect();
		});

		socket.on("disconnect", () => {
			
			
			
			if (!session.startgame && session.gametype === "online") {
				
				
				
				if (socket.playerId == session.players_info.p1_id && session.players_info.p2_id !== 0) {
					
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
				
				
				clearInterval(intervalID);
				sessionsmap.delete(socket.sessionId);
				
				return;
			}
			
			
			if (
				socket.session.positions.win == 0 &&
				socket.playerId == socket.session.players_info.p1_id
			) {
				
				socket.session.positions.win = 2;
				session.positions.score.p1 = 0;
				session.positions.score.p2 = 12;
				
			} else if (
				socket.session.positions.win == 0 &&
				socket.playerId == socket.session.players_info.p2_id
			) {
				
				socket.session.positions.win = 1;
				session.positions.score.p1 = 12;
				session.positions.score.p2 = 0;
				
				
				if (session.gametype === "online" && session.players_info.p2_id && session.players_info.p1_id) {
					
					db.run(
						`DELETE FROM notifications WHERE type = 'game_invite' AND sender_id = ? AND user_id = ?`,
						[session.players_info.p1_id, session.players_info.p2_id],
						(err) => {
							if (err) {
								console.error("❌ Error deleting notification:", err);
							} else {
								
								mainIo.to(`user:${session.players_info.p2_id}`).emit("game_invite_expired", {
									senderId: session.players_info.p1_id
								});
							}
						}
					);
				}
				
			}
			
			
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
			
			
			clearInterval(intervalID);
			setTimeout(() => {
				sessionsmap.delete(socket.sessionId);
				
			}, 100);

			
			
			
			

			
			
			

			
			
			
			
			
			
			

			
			
			
			
		});
	});
}
export { sessionsmap };
export default { setupGameSocketIO };