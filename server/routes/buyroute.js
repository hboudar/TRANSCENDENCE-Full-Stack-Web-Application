import { handleBuy } from "../handleBuy.js";

export default async function buySkin(fastify, opts) {
	const { db } = opts;

	fastify.post("/buy", async (request, reply) => {
		const { itemId, itemPrice } = request.body;
		const authenticatedUserId = request.user?.id;

		// SECURITY: Require authentication
		if (!authenticatedUserId) {
			return reply.status(401).send({ success: false, error: "Authentication required" });
		}

		// SECURITY: Use authenticated user ID directly, ignore any userId from request body
		const userId = authenticatedUserId;

		if (!itemId || itemPrice === undefined) {
			return reply.status(400).send({ success: false, error: "Missing required fields" });
		}

		// Verify user exists (should always pass since user is authenticated)
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
