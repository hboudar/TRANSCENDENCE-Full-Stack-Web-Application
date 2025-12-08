import { handleAddFriend } from "../addFriend.js";

export default async function friendRoutes(fastify, opts) {
  const { db, io } = opts;

  fastify.post("/friends", async (request, reply) => {
    const { friendId } = request.body;
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (!friendId) {
      return reply.status(400).send({ error: "Missing friendId" });
    }

    if (Number(userId) === Number(friendId)) {
      return reply.status(400).send({ error: "Cannot add yourself as a friend" });
    }

    const userExists = await new Promise((resolve) => {
      db.get('SELECT id FROM users WHERE id = ?', [userId], (err, row) => {
        resolve(!!row && !err);
      });
    });

    if (!userExists) {
      return reply.status(404).send({ error: "User not found" });
    }

    const friendExists = await new Promise((resolve) => {
      db.get('SELECT id FROM users WHERE id = ?', [friendId], (err, row) => {
        resolve(!!row && !err);
      });
    });

    if (!friendExists) {
      return reply.status(404).send({ error: "Friend not found" });
    }

    try {
      const result = await handleAddFriend(db, Number(userId), Number(friendId));

      if (result.autoAccepted) {
        io.to(`user:${userId}`).emit("friends:updated");
        io.to(`user:${friendId}`).emit("friends:updated");

        return reply.send({
          success: true,
          autoAccepted: true,
          message: "You are now friends!",
        });
      }

      io.to(`user:${friendId}`).emit("friends:request:incoming", {
        fromUserId: Number(userId),
      });

      reply.send({ success: true, message: result.message });
    } catch (err) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });


  fastify.get("/friends/accepted", (request, reply) => {
    const userId = request.user?.id;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const query = `
      SELECT 
        u.id,
        u.name,
        u.picture,
        u.gold,
        CAST(u.games AS INTEGER) AS games,
        CAST(u.win AS INTEGER) AS win,
        CAST(u.lose AS INTEGER) AS lose
      FROM friends f
      JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ? AND f.is_request = 0

      UNION ALL

      SELECT 
        u.id,
        u.name,
        u.picture,
        u.gold,
        CAST(u.games AS INTEGER) AS games,
        CAST(u.win AS INTEGER) AS win,
        CAST(u.lose AS INTEGER) AS lose
      FROM friends f
      JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = ? AND f.is_request = 0
    `;

    db.all(query, [userId, userId], (err, rows) => {
      if (err) return reply.status(503).send({ error: "Database error" });

      const updated = rows.map((user) => {
        const level = ((Number(user.win) || 0) / 10).toFixed(1);
        return { ...user, level: parseFloat(level) };
      });

      reply.send({ data: updated });
    });
  });

  fastify.get("/friends/request", (request, reply) => {
    const userId = request.user?.id;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });
    db.all(
      "SELECT * FROM friends WHERE user_id = ? AND is_request = 1",
      [userId],
      (err, rows) => {
        if (err) return reply.code(503).send({ error: "Database error" });
        reply.send({ data: rows });
      }
    );
  });

  fastify.post("/friends/remove", (request, reply) => {
    const { friendId } = request.body;
    const userId = request.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (!friendId) {
      return reply.status(400).send({ error: "Missing friendId" });
    }

    if (Number(userId) === Number(friendId)) {
      return reply.status(400).send({ error: "Invalid operation" });
    }

    db.run(
      `
      DELETE FROM friends 
      WHERE (user_id = ? AND friend_id = ?)
         OR (user_id = ? AND friend_id = ?)
    `,
      [userId, friendId, friendId, userId],
      function (err) {
        if (err) return reply.status(503).send({ error: "Database error" });

        io.to(`user:${userId}`).emit("friends:updated");
        io.to(`user:${friendId}`).emit("friends:updated");

        reply.send({ message: "Friend or request removed successfully" });
      }
    );
  });

  fastify.get("/friends/myrequests", (request, reply) => {
    const userId = request.user?.id;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const sql = `
      SELECT u.id, u.name, u.picture
      FROM friends f
      JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = ? AND f.is_request = 1
    `;

    db.all(sql, [userId], (err, rows) => {
      if (err) return reply.status(503).send({ error: "Database error" });
      reply.send({ data: rows });
    });
  });

  fastify.put("/friends/accept", (request, reply) => {
    const { friendId } = request.body;
    const userId = request.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (!friendId) {
      return reply.status(400).send({ error: "Missing friendId" });
    }

    if (Number(userId) === Number(friendId)) {
      return reply.status(400).send({ error: "Invalid operation" });
    }

    db.run(
      "UPDATE friends SET is_request = 0 WHERE user_id = ? AND friend_id = ?",
      [friendId, userId],
      function (err) {
        if (err) return reply.status(503).send({ error: "Database error" });

        io.to(`user:${userId}`).emit("friends:updated");
        io.to(`user:${friendId}`).emit("friends:updated");

        reply.send({ message: "Friend request accepted!" });
      }
    );
  });
}
