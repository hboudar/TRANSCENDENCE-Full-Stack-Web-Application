import { handleBuy } from "../handleBuy.js";

export default async function buySkin(fastify, opts) {
	const { db } = opts;

	fastify.post("/buy", async (request, reply) => {
		const { userId, itemId, itemPrice } = request.body;

		if (!userId || !itemId || itemPrice === undefined) {
			return reply.status(400).send({ success: false, error: "Missing required fields" });
		}

		// Verify user exists
		const userExists = await new Promise((resolve) => {
			db.get('SELECT id FROM users WHERE id = ?', [userId], (err, row) => {
				resolve(!!row && !err);
			});
		});

		if (!userExists) {
			return reply.status(404).send({ success: false, error: "User not found" });
		}

		// Verify item exists
		const itemExists = await new Promise((resolve) => {
			db.get('SELECT id FROM skins WHERE id = ?', [itemId], (err, row) => {
				resolve(!!row && !err);
			});
		});

		if (!itemExists) {
			return reply.status(404).send({ success: false, error: "Item not found" });
		}

		try {
			const result = await handleBuy(db, Number(userId), Number(itemId), itemPrice);
			reply.send({ success: true, message: result.message });
		} catch (err) {
			reply.status(400).send({ success: false, error: err.message });
		}
	});
}
