import { checkFriendship, checkBlock } from '../utils/friendshipHelper.js';

const schemasearch = {
  querystring: {
    type: "object",
    properties: {
      search: { type: "string" },
    },
    required: ["search"],
  },
};

const schemasendmessage = {
  body: {
    type: "object",
    properties: {
      receiver_id: { type: "integer" },
      content: { type: "string", minLength: 1, maxLength: 400 },  // Max 400 characters
    },
    required: ["receiver_id", "content"],
  },
};

const schemagetmessages = {
  params: {
    type: "object",
    properties: {
      sender_id: { type: "integer" },
      receiver_id: { type: "integer" },
    },
    required: ["sender_id", "receiver_id"],
  },
};
const schemalastmessage = {
  params: {
    type: "object",
    properties: {
      sender_id: { type: "integer" },
      receiver_id: { type: "integer" },
    },
    required: ["sender_id", "receiver_id"],
  },
};

export default async function chatRoutes(fastify, opts) {
  const db = opts.db;

  fastify.get("/search",schemasearch, async (req, reply) => {
    const { search } = req.query;
    const userId = req.user?.id;
    
    // Authorization check
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    
    // Input validation
    if (!search || typeof search !== 'string') {
      return reply.status(400).send({ error: "Invalid search query" });
    }
    
    if (search.length > 100) {
      return reply.status(400).send({ error: "Search query too long" });
    }
    
    // Sanitize input - remove special SQL characters
    const sanitizedSearch = search.replace(/[%_\\]/g, '');
    
    return new Promise((resolve, reject) => {
      // Search only among user's accepted friends
      db.all(
        `SELECT u.id, u.name, u.email, u.picture 
         FROM users u
         INNER JOIN friends f ON (
           (f.user_id = ? AND f.friend_id = u.id) OR 
           (f.friend_id = ? AND f.user_id = u.id)
         )
         WHERE f.is_request = 0 
         AND (u.name LIKE ? OR u.email LIKE ?)
         LIMIT 20`,
        [userId, userId, `%${sanitizedSearch}%`, `%${sanitizedSearch}%`],
        (err, rows) => {
          if (err) {
            console.error("Search friends error:", err.message);
            reply.status(503).send({ error: "Database error" });
            return reject(err);
          }
          resolve(rows);
        }
      );
    });
  });

  

  // Insert message
  fastify.post("/messages",schemasendmessage, async (req, reply) => {
    const { receiver_id, content } = req.body;
    const sender_id = req.user?.id; // Get sender from authenticated user

    if (!sender_id) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // Check if user is trying to send message to themselves
    if (sender_id === receiver_id) {
      return reply.status(400).send({ error: "Cannot send messages to yourself" });
    }

    try {
      // Check if either user has blocked the other
      const block = await checkBlock(db, sender_id, receiver_id);
      if (block) {
        const message = block.blocker_id === sender_id 
          ? "You have blocked this user. Unblock to send messages." 
          : "This user has blocked you. You cannot send messages.";
        return reply.status(403).send({ error: message });
      }

      // Check if users are friends
      const areFriends = await checkFriendship(db, sender_id, receiver_id);
      if (!areFriends) {
        return reply.status(403).send({ error: "You can only send messages to friends" });
      }

      // Verify both users exist and insert message
      return new Promise((resolve, reject) => {
        db.get(
          `SELECT id FROM users WHERE id = ?`,
          [sender_id],
          (err, senderRow) => {
            if (err) {
              reply.status(503).send({ error: "Database error" });
              return reject(err);
            }
            if (!senderRow) {
              reply.status(404).send({ error: "Sender not found" });
              return resolve();
            }

            db.get(
              `SELECT id FROM users WHERE id = ?`,
              [receiver_id],
              (err, receiverRow) => {
                if (err) {
                  reply.status(503).send({ error: "Database error" });
                  return reject(err);
                }
                if (!receiverRow) {
                  reply.status(404).send({ error: "Receiver not found" });
                  return resolve();
                }

                // Both users exist, are friends, and no blocks - insert message
                db.run(
                  `INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)`,
                  [sender_id, receiver_id, content],
                  function (err) {
                    if (err) {
                      reply.status(503).send({ error: "Database error" });
                      return reject(err);
                    }
                    resolve({ id: this.lastID, sender_id, receiver_id, content });
                  }
                );
              }
            );
          }
        );
      });
    } catch (error) {
      console.error("Error in message endpoint:", error);
      return reply.status(503).send({ error: "Database error" });
    }
  });

  // // Get all messages
  // fastify.get("/messages", async (req, reply) => {
  //   return new Promise((resolve, reject) => {
  //     db.all(`SELECT * FROM messages`, [], (err, rows) => {
  //       if (err) {
  //         reply.status(503).send({ error: "Database error" });
  //         return reject(err);
  //       }
  //       resolve(rows);
  //     });
  //   });
  // });

  // Get messages between two users
  fastify.get("/messages/:sender_id/:receiver_id",schemagetmessages, async (req, reply) => {
    const { sender_id, receiver_id } = req.params;
    const userId = req.user?.id;
    
    // Authorization check - user must be part of this conversation
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    
    if (userId != sender_id && userId != receiver_id) {
      return reply.status(403).send({ error: "Forbidden: You can only view your own messages" });
    }
    
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
        [sender_id, receiver_id, receiver_id, sender_id],
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

  // Get last message between two users
  fastify.get("/lastmessage/:sender_id/:receiver_id",schemalastmessage, async (req, reply) => {
    const { sender_id, receiver_id } = req.params;
    const userId = req.user?.id;
    
    // Authorization check - user must be part of this conversation
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    
    if (userId != sender_id && userId != receiver_id) {
      return reply.status(403).send({ error: "Forbidden: You can only view your own messages" });
    }

    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM messages 
             WHERE (sender_id = ? AND receiver_id = ?) 
                OR (sender_id = ? AND receiver_id = ?) 
             ORDER BY created_at DESC LIMIT 1`,
        [sender_id, receiver_id, receiver_id, sender_id],
        (err, row) => {
          if (err) {
            reply.status(503).send({ error: "Database error" });
            return reject(err);
          }

          if (!row) {
            // 👇 Always send a JSON object, even if empty
            reply.send({ content: "" });
            return resolve();
          }

          // ✅ Message found, send it
          reply.send({ content: row.content });
          resolve();
        }
      );
    });
  });
}
