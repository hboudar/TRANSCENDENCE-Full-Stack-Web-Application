/** @format */

export default async function gameRoutes(fastify, opts) {
	const db = opts.db;

	// Get all games
	fastify.get("/games", async (req, reply) => {
		return new Promise((resolve, reject) => {
			db.all(`SELECT * FROM games`, [], (err, rows) => {
				if (err) {
					reply.status(500).send({ error: "Database error" });
					return reject(err);
				}
				resolve(rows);
			});
		});
	});

	fastify.post("/games/:player2_id", async (req, reply) => {
		const player2_id = req.params.player2_id;
		const authenticatedUserId = req.user?.id;

		if (!authenticatedUserId) {
			return reply.status(401).send({ error: "Authentication required" });
		}

		// SECURITY: Player 1 is always the authenticated user
		const player1_id = authenticatedUserId;

		if (!player2_id) {
			reply.status(400).send({ error: "Player 2 ID is required" });
			return;
		}

		// Prevent playing against yourself
		if (Number(player1_id) === Number(player2_id)) {
			reply.status(400).send({ error: "Cannot play against yourself" });
			return;
		}

		// Verify both players exist
		const player1Exists = await new Promise((resolve) => {
			db.get('SELECT id FROM users WHERE id = ?', [player1_id], (err, row) => {
				resolve(!!row && !err);
			});
		});

		if (!player1Exists) {
			reply.status(404).send({ error: "Player 1 not found" });
			return;
		}

		const player2Exists = await new Promise((resolve) => {
			db.get('SELECT id FROM users WHERE id = ?', [player2_id], (err, row) => {
				resolve(!!row && !err);
			});
		});

		if (!player2Exists) {
			reply.status(404).send({ error: "Player 2 not found" });
			return;
		}

		const date = new Date().toISOString();
		const {
			player1_score,
			player2_score,
			player1_gold_earned,
			player2_gold_earned,
			winner_id,
		} = req.body;
		return new Promise(
			(resolve, reject) => {
				db.run(
					`INSERT INTO games (date, player1_id, player2_id, player1_score, player2_score, player1_gold_earned, player2_gold_earned, winner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						date,
						player1_id,
						player2_id,
						player1_score,
						player2_score,
						player1_gold_earned,
						player2_gold_earned,
						winner_id,
					],
					function (err) {
						if (err) {
							reply.status(500).send({ error: "Database error" });
							return reject(err);
						}
						resolve({ id: this.lastID });
					}
				);
			},
			// update the user gold after a game
			db.run(
				`UPDATE users SET gold = gold + ?,
                          games = games + 1,
                          win = win + ?,
                          lose = lose + ? 
                      WHERE id = ?`,
				[
					player1_gold_earned,
					winner_id == player1_id,
					winner_id == player2_id,
					player1_id,
				],
				(err) => {
					if (err) {
						reply.status(500).send({ error: "Database error" });
						return reject(err);
					}
				}
			)
		);
	});

	// get all games for a specific user

	fastify.get("/games/:userId", async (req, reply) => {
		const userId = req.params.userId;

		return new Promise((resolve, reject) => {
			db.all(
				`SELECT * FROM games WHERE player1_id = ? OR player2_id = ?`,
				[userId, userId],
				(err, rows) => {
					if (err) {
						reply.status(500).send({ error: "Database error" });
						return reject(err);
					}
					resolve(rows);
				}
			);
		});
	});
	// get all games won by a specific user
	// fastify.get('/games/won/:userId', async (req, reply) => {
	//     const userId = req.params.userId;

	//     return new Promise((resolve, reject) => {
	//         db.all(`SELECT * FROM games WHERE winner_id = ?`, [userId], (err, rows) => {
	//             if (err) {
	//                 reply.status(500).send({ error: 'Database error' });
	//                 return reject(err);
	//             }
	//             resolve(rows);
	//         });
	//     });
	// });
	// // get all games lost by a specific user
	// fastify.get('/games/lost/:userId', async (req, reply) => {
	//     const userId = req.params.userId;

	//     return new Promise((resolve, reject) => {
	//         db.all(`SELECT * FROM games WHERE (player1_id = ? AND winner_id != ?) OR (player2_id = ? AND winner_id != ?)`, [userId, userId, userId, userId], (err, rows) => {
	//             if (err) {
	//                 reply.status(500).send({ error: 'Database error' });
	//                 return reject(err);
	//             }
	//             resolve(rows);
	//         });
	//     });
	// });
}
// gameRoutes.js (ES Module)