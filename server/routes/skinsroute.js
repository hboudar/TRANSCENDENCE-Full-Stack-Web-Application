/** @format */

export default function skinsRoutes(fastify, opts) {
	const db = opts.db;
	// db.run(`DROP TABLE skins;`)
	db.run(`
    INSERT OR IGNORE INTO skins (name, type, price, color, img) VALUES
    ('Solar Flare', 'ball'   , 0, '#FFD54F', '#FFD54F'),
    ('Ruby Velvet', 'table'  , 0, '#E53935', '/table1.png'),
    ('Sapphire Wave', 'paddle' , 0, '#1E88E5', '#1E88E5'),
    ('Amethyst Dream', 'table'  , 0, '#9C27B0', '#9C27B0'),
    ('Jade Forest', 'paddle' , 0, '#66BB6A', '#66BB6A'),
    ('Fuchsia Blast', 'ball'   , 0, '#EC407A', '#EC407A'),
    ('Amber Glow', 'paddle' , 0, '#FFB300', '#FFB300'),
    ('Obsidian Core', 'ball'   , 0, '#283593', '#283593'),
    ('Aqua Marine', 'table'  , 0, '#26C6DA', '#26C6DA'),
    ('Scarlet Fire', 'paddle' , 0, '#D32F2F', '#D32F2F'),
    ('Arctic Cyan', 'ball'   , 0, '#00E5FF', '#00E5FF'),
    ('Mint Paradise', 'table'  , 0, '#26A69A', '#26A69A'),
    ('Tangerine Burst', 'ball'   , 0, '#FF7043', '#FF7043'),
    ('Graphite Steel', 'table'  , 0, '#37474F', '#37474F'),
    ('Pearl White', 'paddle' , 0, '#FFFFFF', '#FFFFFF')
    `);

	fastify.get("/player_skins", async (request, reply) => {
		return new Promise((resolve, reject) => {
			const { player_id } = request.query;
			if (!player_id) {
				reply.status(400).send({ error: "Missing player_id in query" });
				return reject(new Error("Missing player_id in query"));
			}
			db.all(
				`SELECT *  FROM player_skins
                    JOIN skins ON player_skins.skin_id = skins.id
                  WHERE player_id = ?;`,
				[player_id],
				(err, rows) => {
					if (err) {
						reply.status(500).send({ error: "Database error" });
						return reject(err);
					}
					console.log(rows);

					resolve(rows);
				}
			);
		});
	});
	fastify.get("/selected_skins", async (request, reply) => {
		return new Promise((resolve, reject) => {
			const { player_id } = request.query;
			if (!player_id) {
				reply.status(400).send({ error: "Missing player_id in query" });
				return reject(new Error("Missing player_id in query"));
			}

			db.all(
				`SELECT player_skins.*, skins.* 
       FROM player_skins
       JOIN skins ON player_skins.skin_id = skins.id
       WHERE player_id = ? AND selected = 1;`,
				[player_id],
				(err, rows) => {
					if (err) {
						reply.status(500).send({ error: "Database error" });
						return reject(err);
					}

					// ✅ Must have exactly 3 selected skins
					if (!rows || rows.length !== 3) {
						reply
							.status(400)
							.send({ error: "Player must have exactly 3 selected skins" });
						return reject(new Error("Invalid skin count"));
					}

					// ✅ Check that we have 1 of each type
					const requiredTypes = ["table", "paddle", "ball"];
					const types = rows.map((r) => r.type);

					for (const type of requiredTypes) {
						if (!types.includes(type)) {
							reply
								.status(400)
								.send({ error: `Missing required skin type: ${type}` });
							return reject(new Error(`Missing skin type: ${type}`));
						}
					}

					// ✅ Sort rows in order: table → paddle → ball
					const order = { table: 1, paddle: 2, ball: 3 };
					rows.sort((a, b) => order[a.type] - order[b.type]);

					resolve(rows);
				}
			);
		});
	});

	fastify.post("/select_skin", async (request, reply) => {
		console.log("POST");

		return new Promise((resolve, reject) => {
			const { player_id, oldskin, newskin } = request.query;
			if (!player_id || !oldskin || !newskin) {
				reply.status(400).send({ error: "Missing player_id in query" });
				return reject(new Error("Missing player_id in query"));
			}
			db.all(
				`SELECT player_skins.* , skins.type
             FROM player_skins
             JOIN skins ON player_skins.skin_id = skins.id
             WHERE player_id = ?
               AND (skin_id = ? OR skin_id = ?)`,
				[player_id, oldskin, newskin],
				(err, rows) => {
					if (err) {
						reply.status(500).send({ error: "Database error" });
						return reject(err);
					} else if (rows.length != 2 || rows[0].type != rows[1].type) {
						reply.status(500).send({ error: "Database error" });
						return reject(new Error("diferent skin type"));
					} else {
						db.run(
							`UPDATE player_skins
                       SET selected = 0
                       WHERE player_id = ? AND skin_id = ?`,
							[player_id, oldskin],
							function (err) {
								if (err) {
									console.error("Error updating row:", err);
								}
							}
						);
						db.run(
							`UPDATE player_skins
                       SET selected = 1
                       WHERE player_id = ? AND skin_id = ?`,
							[player_id, newskin],
							function (err) {
								if (err) {
									console.error("Error updating row:", err);
								}
							}
						);
					}

					resolve(rows);
				}
			);
		});
	});
	// db.serialize(() => {
	// 	// db.run("DELETE FROM skins");
	// 	// Paddles
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["paddle1", "paddle", 90, "/paddle.webp"]);
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["paddle2", "paddle", 110, "/blue-precision-paddle.png"]);
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["paddle3", "paddle", 135, "/futuristic-quantum-paddle.png"]);
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["paddle4", "paddle", 140, "/purple-magical-paddle.png"]);
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["paddle5", "paddle", 150, "/red-speed-ping-pong-paddle-flames.png"]);

	// 	// Tables
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["table1", "table", 500, "/table1.png"]);
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["table2", "table", 500, "/table2.png"]);
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["table3", "table", 500, "/table3.png"]);
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["table4", "table", 500, "/table4.png"]);
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["table5", "table", 700, "/luxury-diamond-ping-pong.png"]);
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["table6", "table", 600, "/neon-purple-ping-pong.png"]);

	// 	// Balls
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["ball1", "ball", 50, "/ball.webp"]);
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["ball2", "ball", 60, "/ball-2-blue-metallic.png"]);
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["ball3", "ball", 70, "/ball-3-green-textured.png"]);
	// 	db.run("INSERT OR IGNORE INTO skins (name, type, price, img) VALUES (?, ?, ?, ?)", ["ball4", "ball", 70, "/ball-6-yellow-star.png"]);
	// });
}
