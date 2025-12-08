

import fastify from "fastify";
import { sessionsmap } from "../game.js";
import { randomUUID } from "crypto";

const gameApiRoute = async (fastify, options) => {
	const { db } = options;

	
	fastify.get("/games/cli/active", async (request, reply) => {
		try {
			const activeSessions = Array.from(sessionsmap.entries()).map(
				([sessionId, session]) => ({
					sessionId,
					players: {
						player1: {
							id: session.players_info.p1_id,
							name: session.players_info.p1_name,
							ready: session.p1_ready,
						},
						player2: session.players_info.p2_id
							? {
									id: session.players_info.p2_id,
									name: session.players_info.p2_name,
									ready: session.p2_ready,
							  }
							: null,
					},
					gameType: session.gametype,
					status: session.startgame ? "active" : "waiting",
					score: session.positions?.score || { p1: 0, p2: 0 },
				})
			);

			return {
				success: true,
				count: activeSessions.length,
				sessions: activeSessions,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			console.error("Error fetching active games:", error);
			return reply.status(500).send({
				success: false,
				error: "Failed to fetch active games",
			});
		}
	});

	
	fastify.get("/games/cli/session/:sessionId", async (request, reply) => {
		try {
			const { sessionId } = request.params;
			const session = sessionsmap.get(sessionId);

			if (!session) {
				return reply.status(404).send({
					success: false,
					error: "Game session not found",
				});
			}

			return {
				success: true,
				session: {
					sessionId,
					players: session.players_info,
					gameType: session.gametype,
					p1_ready: session.p1_ready,
					p2_ready: session.p2_ready,
					startgame: session.startgame,
					score: session.positions?.score || { p1: 0, p2: 0 },
					positions: {
						p1: session.positions?.p1,
						p2: session.positions?.p2,
						ballx: session.positions?.ballx,
						bally: session.positions?.bally,
						win: session.positions?.win,
					},
				},
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			console.error("Error fetching game session:", error);
			return reply.status(500).send({
				success: false,
				error: "Failed to fetch game session",
			});
		}
	});

	
	fastify.get("/games/cli/stats", async (request, reply) => {
		try {
			const stats = await new Promise((resolve, reject) => {
				db.all(
					`SELECT 
						COUNT(*) as total_games,
						COUNT(DISTINCT player1_id) + COUNT(DISTINCT player2_id) as total_players,
						AVG(player1_score + player2_score) as avg_total_score,
						MAX(player1_score) as highest_score
					FROM games`,
					[],
					(err, rows) => {
						if (err) return reject(err);
						resolve(rows[0] || {});
					}
				);
			});

			return {
				success: true,
				stats: {
					...stats,
					active_sessions: sessionsmap.size,
				},
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			console.error("Error fetching stats:", error);
			return reply.status(500).send({
				success: false,
				error: "Failed to fetch statistics",
			});
		}
	});
	fastify.post("/games/start", async (request, reply) => {
		try {
		
		const authenticatedUserId = request.user?.id;
		
		if (!authenticatedUserId) {
			return reply.status(401).send({
				success: false,
				error: "Authentication required",
			});
		}
		
		const {
			player2_id,
			invited_player,
			player2_name,
			game_type,
			sessionId,
		} = request.body;

		if (
			!game_type ||
			!sessionId
		) {
			return reply.status(400).send({
				success: false,
				error: "missing data",
			});
		}

		
		const player_id = authenticatedUserId;

		
		const playerData = await new Promise((resolve, reject) => {
			db.get('SELECT name, picture FROM users WHERE id = ?', [player_id], (err, row) => {
				if (err) return reject(err);
				if (!row) return reject(new Error('User not found'));
				resolve(row);
			});
		});

		if (!playerData) {
			return reply.status(404).send({
				success: false,
				error: "User not found",
			});
		}

		const player_name = playerData.name;
		const player_img = playerData.picture || playerData.name;			const ingame = Array.from(sessionsmap.values()).some(
				(player) =>
					(player.players_info.p1_id == player_id && player.p1_ready) ||
					(player.players_info.p2_id == player_id && player.p2_ready)
			);
			if (ingame) {
				return reply.status(409).send({
					success: false,
					alreadyInGame: true,
					error: "player already exists in an active game",
				});
			}
			if (invited_player) {
				const invitedSession = Array.from(sessionsmap.entries()).find(
					([sessionId, session]) =>
						session.gametype == "online" &&
						session.players_info.p1_id == player2_id
				);
				if (!invitedSession) {
					
					return reply.status(404).send({
						success: false,
						sessionNotFound: true,
						error: "Game session no longer exists. Host may have disconnected.",
					});
				}
				if (invitedSession) {
					const [sessionId, session] = invitedSession;
					session.players_info.p2_id = player_id;
					session.players_info.p2_name = player_name;
					session.players_info.p2_img = player_img;
					session.p2_ready = true;
					
					return reply.status(201).send({
						success: true,
						message: "player added successfully",
						sessionId: sessionId,
					});
				}
			}
			if (game_type == "online" && !player2_id) {
				const onlineSession = Array.from(sessionsmap.entries()).find(
					([sessionId, session]) =>
						session.gametype == "online" && session.players_info.p2_id == 0
				);
				if (onlineSession) {
					const [sessionId, session] = onlineSession;
					session.players_info.p2_id = player_id;
					session.players_info.p2_name = player_name;
					session.players_info.p2_img = player_img;
					session.p2_ready = true;
					

					return reply.status(201).send({
						success: true,
						message: "player added successfully",
						sessionId: sessionId,
					});
				}
			}
			

			sessionsmap.set(sessionId, {
				players_info: {
					p1_id: player_id,
					p2_id: player2_id ? player2_id : 0,
					p1_name: player_name,
					p1_img: player_img,
					p2_name: player2_name ? player2_name : "player 2",
					p2_img: player_img,
				},
				p1_ready: true,
				p2_ready: false,
				gametype: game_type,
				startgame: false,
				positions: {},
			});
			return reply.status(201).send({
				success: true,
				message: "player added successfully",
				sessionId: sessionId,
			});
		} catch (error) {
			console.error("Error starting game:", error);
			return reply.status(503).send({
				success: false,
				error: "Failed to start game",
			});
		}
	});
	fastify.post("/tournament_win", async (request, reply) => {
		const authenticatedUserId = request.user?.id;

		if (!authenticatedUserId) {
			return reply.status(401).send({ success: false, error: "Authentication required" });
		}

		
		const userId = authenticatedUserId;

		
		const userExists = await new Promise((resolve) => {
			db.get('SELECT id FROM users WHERE id = ?', [userId], (err, row) => {
				resolve(!!row && !err);
			});
		});

		if (!userExists) {
			return reply.status(404).send({ success: false, error: "User not found" });
		}

		try {
			
			db.run(
				`UPDATE users SET tounaments_won =  ? WHERE id = ?`,
				[1, userId],
				function (err) {
					if (err) {
						console.error("Error updating tournaments won:", err);
						return reply.status(503).send({
							success: false,
							error: "Failed to update tournaments won",
						});
					}
					return reply.send({
						success: true,
						message: "Tournaments won updated successfully",
					});
				}
			);
		} catch (error) {
			console.error("Error updating tournaments won:", error);
			return reply.status(503).send({
				success: false,
				error: "Failed to update tournaments won",
			});
		}
	});
};

export default gameApiRoute;