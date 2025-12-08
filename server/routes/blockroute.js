import { checkFriendship } from '../utils/friendshipHelper.js';

export default async function blockRoutes(fastify, opts) {
    const { db } = opts;

    fastify.post('/blocks', async (request, reply) => {
        const { blocked_id } = request.body;
        const blocker_id = request.user?.id; 

        if (!blocker_id) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        if (!blocked_id) {
            return reply.status(400).send({ error: 'blocked_id is required' });
        }

        if (blocker_id === blocked_id) {
            return reply.status(400).send({ error: 'Cannot block yourself' });
        }

        try {
            const areFriends = await checkFriendship(opts.db, blocker_id, blocked_id);
            if (!areFriends) {
                return reply.status(403).send({ error: 'You can only block friends' });
            }
            const existingBlock = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT * FROM blocks WHERE 
                     (blocker_id = ? AND blocked_id = ?) OR 
                     (blocker_id = ? AND blocked_id = ?)`,
                    [blocker_id, blocked_id, blocked_id, blocker_id],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (existingBlock) {
                if (existingBlock.blocker_id === blocker_id) {
                    return reply.status(400).send({ error: 'You have already blocked this user' });
                } else {
                    return reply.status(403).send({ error: 'This user has already blocked you' });
                }
            }
            return new Promise((resolve, reject) => {
                db.get(
                    `SELECT id FROM users WHERE id = ?`,
                    [blocker_id],
                    (err, blockerRow) => {
                        if (err) {
                            reply.status(503).send({ error: 'Database error' });
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
                                    reply.status(503).send({ error: 'Database error' });
                                    return reject(err);
                                }
                                if (!blockedRow) {
                                    reply.status(404).send({ error: 'User to block not found' });
                                    return resolve();
                                }
                                db.run(
                                    `INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)`,
                                    [blocker_id, blocked_id],
                                    function (err) {
                                        if (err) {
                                            console.error('Error blocking user:', err);
                                            reply.status(503).send({ 
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
        } catch (error) {
            console.error('Error in block endpoint:', error);
            return reply.status(503).send({ error: 'Database error' });
        }
    });
    fastify.delete('/blocks', async (request, reply) => {
        const { blocked_id } = request.body;
        const blocker_id = request.user?.id; 

        if (!blocker_id) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        if (!blocked_id) {
            return reply.status(400).send({ error: 'blocked_id is required' });
        }

        if (blocker_id === blocked_id) {
            return reply.status(400).send({ error: 'Cannot unblock yourself' });
        }

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM users WHERE id = ?`,
                [blocker_id],
                (err, blockerRow) => {
                    if (err) {
                        reply.status(503).send({ error: 'Database error' });
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
                                reply.status(503).send({ error: 'Database error' });
                                return reject(err);
                            }
                            if (!blockedRow) {
                                reply.status(404).send({ error: 'User to unblock not found' });
                                return resolve();
                            }

                            db.run(
                                `DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?`,
                                [blocker_id, blocked_id],
                                function (err) {
                                    if (err) {
                                        console.error('Error unblocking user:', err);
                                        reply.status(503).send({ 
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
                        reply.status(503).send({ 
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

    fastify.get('/blocks/:user_id', async (request, reply) => {
        const { user_id } = request.params;

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT blocked_id FROM blocks WHERE blocker_id = ?`,
                [user_id],
                (err, rows) => {
                    if (err) {
                        console.error('Error fetching blocked users:', err);
                        reply.status(503).send({ 
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
