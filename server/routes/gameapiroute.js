/** @format */

import fastify from "fastify";
import { sessionsmap } from "../game.js";
import { randomUUID } from "crypto";

const gameApiRoute = async (fastify, options) => {
	const { db } = options;

	// === GAME INITIALIZATION ===

	// Start a new game session
	fastify.post("/games/start", async (request, reply) => {
		try {
		// Get authenticated user from middleware
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

		// SECURITY: Use authenticated user ID directly, never trust client input
		const player_id = authenticatedUserId;

		// SECURITY: Fetch player name and image from database, never trust client
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
					// Session not found - host may have disconnected
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
					// console.log("player 2", sessionsmap);
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
					// console.log("player 2", sessionsmap);

					return reply.status(201).send({
						success: true,
						message: "player added successfully",
						sessionId: sessionId,
					});
				}
			}
			// console.log("new session flow");

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
	fastify.get("/games/active", async (request, reply) => {
		// SECURITY: Require authentication to view active games
		if (!request.user?.id) {
			return reply.status(401).send({ success: false, error: "Authentication required" });
		}

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
			};
		} catch (error) {
			console.error("Error fetching active games:", error);
			return reply.status(503).send({
				success: false,
				error: "Failed to fetch active games",
			});
		}
	});

	// Get specific game session details
	fastify.get("/games/session/:sessionId", async (request, reply) => {
		// SECURITY: Require authentication
		const authenticatedUserId = request.user?.id;
		if (!authenticatedUserId) {
			return reply.status(401).send({ success: false, error: "Authentication required" });
		}

		try {
			const { sessionId } = request.params;
			const session = sessionsmap.get(sessionId);

			if (!session) {
				return reply.status(404).send({
					success: false,
					error: "Game session not found",
				});
			}

			// SECURITY: Verify user is a participant in this session
			if (session.players_info.p1_id !== authenticatedUserId && 
			    session.players_info.p2_id !== authenticatedUserId) {
				return reply.status(403).send({
					success: false,
					error: "Forbidden: You are not a participant in this game",
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
					positions: session.positions,
				},
			};
		} catch (error) {
			console.error("Error fetching game session:", error);
			return reply.status(503).send({
				success: false,
				error: "Failed to fetch game session",
			});
		}
	});
	fastify.post("/tournament_win", async (request, reply) => {
		const authenticatedUserId = request.user?.id;

		if (!authenticatedUserId) {
			return reply.status(401).send({ success: false, error: "Authentication required" });
		}

		// SECURITY: Use authenticated user ID directly
		const userId = authenticatedUserId;

		// Verify user exists
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
	// End a game session
	fastify.post("/games/session/:sessionId/end", async (request, reply) => {
		try {
			const { sessionId } = request.params;
			const authenticatedUserId = request.user?.id;

			if (!authenticatedUserId) {
				return reply.status(401).send({
					success: false,
					error: "Authentication required",
				});
			}

			const session = sessionsmap.get(sessionId);

			if (!session) {
				return reply.status(404).send({
					success: false,
					error: "Game session not found",
				});
			}

			// SECURITY: Verify that the authenticated user is one of the players
			const isPlayer1 = Number(session.players_info.p1_id) === Number(authenticatedUserId);
			const isPlayer2 = Number(session.players_info.p2_id) === Number(authenticatedUserId);
			
			if (!isPlayer1 && !isPlayer2) {
				return reply.status(403).send({
					success: false,
					error: "You can only end your own game sessions",
				});
			}

			// Clean up game session
			sessionsmap.delete(sessionId);

			return {
				success: true,
				message: "Game session ended successfully",
			};
		} catch (error) {
			console.error("Error ending game session:", error);
			return reply.status(503).send({
				success: false,
				error: "Failed to end game session",
			});
		}
	});
};

export default gameApiRoute;