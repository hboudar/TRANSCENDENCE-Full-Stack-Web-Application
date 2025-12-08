import { handleBuy } from "../handleBuy.js";

export default async function buySkin(fastify, opts) {
	const { db } = opts;

	fastify.post("/buy", async (request, reply) => {
		const { itemId } = request.body;
		const authenticatedUserId = request.user?.id;

		if (!authenticatedUserId) {
			return reply.status(401).send({ success: false, error: "Authentication required" });
		}

		const userId = authenticatedUserId;

		if (!itemId) {
			return reply.status(400).send({ success: false, error: "Missing required fields" });
		}

		try {
			const result = await handleBuy(db, Number(userId), Number(itemId));
			reply.send({ success: true, message: result.message });
		} catch (err) {
			reply.status(400).send({ success: false, error: err.message });
		}
	});
}
