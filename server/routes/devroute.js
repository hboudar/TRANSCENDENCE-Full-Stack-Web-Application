
export default async function userRoutes(fastify, opts) {
  const db = opts.db;

  fastify.get("/users", async (req, reply) => {
    if (!req.user?.id) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    return new Promise((resolve, reject) => {
      db.all(`SELECT id, name, picture, gold, games, win, lose FROM users`, [], (err, rows) => {
        if (err) {
          reply.status(503).send({ error: "Database error" });
          return reject(err);
        }
        resolve(rows);
      });
    });
  });

  fastify.get("/users/:id", async (req, reply) => {
    if (!req.user?.id) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    const userId = req.params.id;

    return new Promise((resolve, reject) => {
      db.get(`SELECT id, name, email, picture, gold, games, win, lose, rps_wins, rps_losses, rps_draws FROM users WHERE id = ?`, [userId], (err, row) => {
        if (err) {
          return reject({ statusCode: 503, error: "Database error" });
        }
        if (!row) {
          return reject({ statusCode: 404, error: "User not found" });
        }
        const profile = {
          id: row.id,
          name: row.name,
          picture: row.picture,
          gold: row.gold,
          games: row.games,
          win: row.win,
          lose: row.lose,
          rps_wins: row.rps_wins || 0,
          rps_losses: row.rps_losses || 0,
          rps_draws: row.rps_draws || 0
        };
        if (Number(req.user.id) === Number(userId)) {
          profile.email = row.email;
        }
        resolve(profile);
      });
    }).catch(err => {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.error });
      }
      throw err;
    });
  });
}
