export default async function blockRoutes(fastify, opts) {
    const { db } = opts;

    // Block a user
    fastify.post('/blocks', async (request, reply) => {
        const { blocker_id, blocked_id } = request.body;

        if (!blocker_id || !blocked_id) {
            return reply.status(400).send({ error: 'blocker_id and blocked_id are required' });
        }

        if (blocker_id === blocked_id) {
            return reply.status(400).send({ error: 'Cannot block yourself' });
        }

        // Verify both users exist in database
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM users WHERE id = ?`,
                [blocker_id],
                (err, blockerRow) => {
                    if (err) {
                        reply.status(500).send({ error: 'Database error' });
                        return reject(err);
                    }
                    if (!blockerRow) {
                        reply.status(404).send({ error: 'Blocker user not found' });
                        return resolve();
                    }

                    db.get(
                        `SELECT id FROM users WHERE id = ?`,
                        [blocked_id],
                        (err, blockedRow) => {
                            if (err) {
                                reply.status(500).send({ error: 'Database error' });
                                return reject(err);
                            }
                            if (!blockedRow) {
                                reply.status(404).send({ error: 'User to block not found' });
                                return resolve();
                            }

                            // Both users exist, proceed with blocking
                            db.run(
                                `INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)`,
                                [blocker_id, blocked_id],
                                function (err) {
                                    if (err) {
                                        console.error('Error blocking user:', err);
                                        reply.status(500).send({ 
                                            error: 'Failed to block user',
                                            details: err.message 
                                        });
                                        resolve();
                                    } else {
                                        reply.send({ 
                                            message: 'User blocked successfully',
                                            blocker_id,
                                            blocked_id
                                        });
                                        resolve();
                                    }
                                }
                            );
                        }
                    );
                }
            );
        });
    });

    // Unblock a user
    fastify.delete('/blocks', async (request, reply) => {
        const { blocker_id, blocked_id } = request.body;

        if (!blocker_id || !blocked_id) {
            return reply.status(400).send({ error: 'blocker_id and blocked_id are required' });
        }

        if (blocker_id === blocked_id) {
            return reply.status(400).send({ error: 'Cannot unblock yourself' });
        }

        // Verify both users exist in database
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM users WHERE id = ?`,
                [blocker_id],
                (err, blockerRow) => {
                    if (err) {
                        reply.status(500).send({ error: 'Database error' });
                        return reject(err);
                    }
                    if (!blockerRow) {
                        reply.status(404).send({ error: 'Blocker user not found' });
                        return resolve();
                    }

                    db.get(
                        `SELECT id FROM users WHERE id = ?`,
                        [blocked_id],
                        (err, blockedRow) => {
                            if (err) {
                                reply.status(500).send({ error: 'Database error' });
                                return reject(err);
                            }
                            if (!blockedRow) {
                                reply.status(404).send({ error: 'User to unblock not found' });
                                return resolve();
                            }

                            // Both users exist, proceed with unblocking
                            db.run(
                                `DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?`,
                                [blocker_id, blocked_id],
                                function (err) {
                                    if (err) {
                                        console.error('Error unblocking user:', err);
                                        reply.status(500).send({ 
                                            error: 'Failed to unblock user',
                                            details: err.message 
                                        });
                                        resolve();
                                    } else {
                                        reply.send({ 
                                            message: 'User unblocked successfully',
                                            blocker_id,
                                            blocked_id
                                        });
                                        resolve();
                                    }
                                }
                            );
                        }
                    );
                }
            );
        });
    });

    // Check if user is blocked
    fastify.get('/blocks/check/:blocker_id/:blocked_id', async (request, reply) => {
        const { blocker_id, blocked_id } = request.params;

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM blocks WHERE 
                 (blocker_id = ? AND blocked_id = ?) OR 
                 (blocker_id = ? AND blocked_id = ?)`,
                [blocker_id, blocked_id, blocked_id, blocker_id],
                (err, row) => {
                    if (err) {
                        console.error('Error checking block status:', err);
                        reply.status(500).send({ 
                            error: 'Failed to check block status',
                            details: err.message 
                        });
                        resolve();
                    } else {
                        if (row) {
                            reply.send({ 
                                blocked: true,
                                blocker_id: row.blocker_id,
                                blocked_id: row.blocked_id,
                                is_blocker: row.blocker_id === parseInt(blocker_id)
                            });
                        } else {
                            reply.send({ blocked: false });
                        }
                        resolve();
                    }
                }
            );
        });
    });

    // Get all users blocked by a specific user
    fastify.get('/blocks/:user_id', async (request, reply) => {
        const { user_id } = request.params;

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT blocked_id FROM blocks WHERE blocker_id = ?`,
                [user_id],
                (err, rows) => {
                    if (err) {
                        console.error('Error fetching blocked users:', err);
                        reply.status(500).send({ 
                            error: 'Failed to fetch blocked users',
                            details: err.message 
                        });
                        resolve();
                    } else {
                        const blockedIds = rows.map(row => row.blocked_id);
                        reply.send({ blocked_users: blockedIds });
                        resolve();
                    }
                }
            );
        });
    });
}
