

export default function skinsRoutes(fastify, opts) {
	const db = opts.db;
	
db.run(`
    INSERT OR IGNORE INTO skins (name, type, price, color, img, description) VALUES
    -- BALLS
    ('Solar Flare', 'ball', 0, '#FFD54F', '/Ball_Solar_Flare.webp', 'Bright golden yellow ball with a radiant sun-like glow'),
    ('Fuchsia Blast', 'ball', 0, '#EC407A', '/Ball_Fuchsia_Blast.webp', 'Vibrant hot pink ball with electric energy'),
    ('Arctic Cyan', 'ball', 0, '#4A148C', '/Ball_Arctic_Cyan.webp', 'Deep purple ball with icy cool vibes'),
    ('Obsidian Core', 'ball', 30, '#283593', '/Ball_Obsidian_Core.webp', 'Dark navy blue ball with mysterious depth'),
    ('Tangerine Burst', 'ball', 30, '#FF7043', '/Ball_Tangerine_Burst.webp', 'Bold orange ball with fiery highlights'),
    ('Emerald Spark', 'ball', 30, '#00C853', '/Ball_Emerald_Spark.webp', 'Brilliant green ball with jewel-like shine'),
    ('Violet Storm', 'ball', 30, '#212121', '/Ball_Violet_Storm.webp', 'Sleek black ball with storm cloud essence'),
    ('Crimson Pulse', 'ball', 30, '#FF1744', '/Ball_Crimson_Pulse.webp', 'Intense red ball with pulsating energy'),
    -- TABLES
    ('Emerald Velvet', 'table', 0, '#00695C', '/Table_Emerald_Velvet.webp', 'Rich dark teal surface with luxurious velvet texture'),
    ('Amethyst Dream', 'table', 0, '#9C27B0', '/Table_Amethyst_Dream.webp', 'Royal purple surface with dreamy gemstone finish'),
    ('Aqua Marine', 'table', 0, '#689F38', '/Table_Aqua_Marine.webp', 'Fresh olive green surface with ocean-inspired tones'),
    ('Mint Paradise', 'table', 100, '#26A69A', '/Table_Mint_Paradise.webp', 'Cool turquoise surface with refreshing mint vibes'),
    ('Graphite Steel', 'table', 100, '#37474F', '/Table_Graphite_Steel.webp', 'Industrial dark gray surface with metallic sheen'),
    ('Golden Sand', 'table', 100, '#FFA000', '/Table_Golden_Sand.webp', 'Warm amber gold surface with desert sunset glow'),
    ('Forest Deep', 'table', 100, '#1B5E20', '/Table_Forest_Deep.webp', 'Deep forest green surface with natural woodland feel'),
    ('Royal Purple', 'table', 100, '#C51162', '/Table_Royal_Purple.webp', 'Majestic magenta surface with regal elegance'),
    -- PADDLES
    ('Sapphire Wave', 'paddle', 0, '#00BCD4', '/Paddle_Sapphire_Wave.webp', 'Bright cyan paddle with flowing water energy'),
    ('Jade Forest', 'paddle', 0, '#66BB6A', '/Paddle_Jade_Forest.webp', 'Lush light green paddle with natural harmony'),
    ('Pearl White', 'paddle', 50, '#FFFFFF', '/Paddle_Pearl_White.webp', 'Pure white paddle with elegant pearl shine'),
    ('Amber Glow', 'paddle', 50, '#CDDC39', '/Paddle_Amber_Glow.webp', 'Radiant lime yellow paddle with golden warmth'),
    ('Scarlet Fire', 'paddle', 50, '#D32F2F', '/Paddle_Scarlet_Fire.webp', 'Bold red paddle with blazing flame spirit'),
    ('Copper Blaze', 'paddle', 50, '#FFC107', '/Paddle_Copper_Blaze.webp', 'Metallic gold paddle with copper shimmer'),
    ('Ocean Depth', 'paddle', 50, '#009688', '/Paddle_Ocean_Depth.webp', 'Deep teal paddle with ocean floor mystery'),
    ('Midnight Blue', 'paddle', 50, '#303F9F', '/Paddle_Midnight_Blue.webp', 'Rich indigo paddle with midnight sky depth')
`);

	fastify.get("/player_skins", async (request, reply) => {
		return new Promise((resolve, reject) => {
			const authenticatedUserId = request.user?.id;

			if (!authenticatedUserId) {
				reply.status(401).send({ error: "Authentication required" });
				return reject(new Error("Authentication required"));
			}

			
			const player_id = authenticatedUserId;

			db.all(
				`SELECT *  FROM player_skins
                    JOIN skins ON player_skins.skin_id = skins.id
                  WHERE player_id = ?;`,
				[player_id],
				(err, rows) => {
					if (err) {
						reply.status(503).send({ error: "Database error" });
						return reject(err);
					}
					

					resolve(rows);
				}
			);
		});
	});
	fastify.get("/selected_skins", async (request, reply) => {
		return new Promise((resolve, reject) => {
			const authenticatedUserId = request.user?.id;

			if (!authenticatedUserId) {
				reply.status(401).send({ error: "Authentication required" });
				return reject(new Error("Authentication required"));
			}

			
			const player_id = authenticatedUserId;

			db.all(
				`SELECT player_skins.*, skins.* 
       FROM player_skins
       JOIN skins ON player_skins.skin_id = skins.id
       WHERE player_id = ? AND selected = 1;`,
				[player_id],
				(err, rows) => {
					if (err) {
						reply.status(503).send({ error: "Database error" });
						return reject(err);
					}

					
					if (!rows || rows.length !== 3) {
						reply
							.status(400)
							.send({ error: "Player must have exactly 3 selected skins" });
						return reject(new Error("Invalid skin count"));
					}

					
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

					
					const order = { table: 1, paddle: 2, ball: 3 };
					rows.sort((a, b) => order[a.type] - order[b.type]);

					resolve(rows);
				}
			);
		});
	});

	fastify.post("/select_skin", async (request, reply) => {
		

		return new Promise((resolve, reject) => {
			const { oldskin, newskin } = request.query;
			const authenticatedUserId = request.user?.id;

			if (!authenticatedUserId) {
				reply.status(401).send({ error: "Authentication required" });
				return reject(new Error("Authentication required"));
			}

			if (!oldskin || !newskin) {
				reply.status(400).send({ error: "Missing required parameters" });
				return reject(new Error("Missing required parameters"));
			}

			
			const player_id = authenticatedUserId;

			db.all(
				`SELECT player_skins.* , skins.type
             FROM player_skins
             JOIN skins ON player_skins.skin_id = skins.id
             WHERE player_id = ?
               AND (skin_id = ? OR skin_id = ?)`,
				[player_id, oldskin, newskin],
				(err, rows) => {
					if (err) {
						reply.status(503).send({ error: "Database error" });
						return reject(err);
					} else if (rows.length != 2 || rows[0].type != rows[1].type) {
						reply.status(503).send({ error: "Database error" });
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
	
	
	
	
	
	
	
	

	
	
	
	
	
	
	

	
	
	
	
	
	
}
