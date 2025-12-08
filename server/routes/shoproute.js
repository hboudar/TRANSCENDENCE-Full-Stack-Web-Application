export default async function shopRoute(fastify, opts) {
	const db = opts.db;

	fastify.get("/paddles", (request, reply) => {
		if (!request.user?.id) {
			return reply.status(401).send({ error: "Authentication required" });
		}

		const db = opts.db;
		db.all("SELECT * FROM skins WHERE type = ? AND price > 0", ["paddle"], (err, rows) => {
			if
				(err) reply.code(503).send({ error: "Database error" });
			else
				reply.send(rows);
		});
	});
	fastify.get("/balls", (request, reply) => {
		if (!request.user?.id) {
			return reply.status(401).send({ error: "Authentication required" });
		}

		const db = opts.db;
		db.all("SELECT * FROM skins WHERE type = ? AND price > 0", ["ball"], (err, rows) => {
			if
				(err) reply.code(503).send({ error: "Database error" });
			else
				reply.send(rows);
		});
	});
		fastify.get("/tables", (request, reply) => {
		if (!request.user?.id) {
			return reply.status(401).send({ error: "Authentication required" });
		}

		const db = opts.db;
		db.all("SELECT * FROM skins WHERE type = ? AND price > 0", ["table"], (err, rows) => {
			if (err)
				reply.code(503).send({ error: "Database error" });
			else
				reply.send(rows);
		});
	});
}
