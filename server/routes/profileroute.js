import bcrypt from 'bcryptjs';

export default async function ProfileRoutes(fastify, opts) {
    const db = opts.db;
    const io = opts.io;
    fastify.post('/profile', async (request, reply) => {
        const { userid, name, email, picture, newPassword } = request.body;

        if (!userid) {
            return reply.status(400).send({ error: 'User ID is required' });
        }
 
        if (!request.user || String(request.user.id) !== String(userid)) {
            console.warn('Forbidden profile update attempt', { tokenUser: request.user?.id, targetUser: userid });
            return reply.status(403).send({ error: 'Forbidden: You can only update your own profile' });
        }

        // Verify user exists in database
        const userExists = await new Promise((resolve) => {
            db.get('SELECT id FROM users WHERE id = ?', [userid], (err, row) => {
                resolve(!!row && !err);
            });
        });

        if (!userExists) {
            return reply.status(404).send({ error: 'User not found' });
        }

        console.log("📥 Received profile update request:", { userid, name, picture, hasPassword: !!newPassword });

        // Build the SQL query dynamically based on what fields are provided
        let updateFields = [];
        let updateValues = [];

        if (name) {
            // Check if the new name is different from current name
            const currentUser = await new Promise((resolve) => {
                db.get('SELECT name FROM users WHERE id = ?', [userid], (err, row) => {
                    resolve(row);
                });
            });

            // Only check for duplicates if name is actually changing
            if (currentUser && name !== currentUser.name) {
                const nameExists = await new Promise((resolve) => {
                    db.get('SELECT id FROM users WHERE name = ? AND id != ?', [name, userid], (err, row) => {
                        resolve(!!row && !err);
                    });
                });

                if (nameExists) {
                    return reply.status(409).send({ error: 'Username already taken' });
                }
            }

            updateFields.push('name = ?');
            updateValues.push(name);
        }

        if (email) {
            // Check if the new email is different from current email
            const currentUser = await new Promise((resolve) => {
                db.get('SELECT email FROM users WHERE id = ?', [userid], (err, row) => {
                    resolve(row);
                });
            });

            // Only check for duplicates if email is actually changing
            if (currentUser && email !== currentUser.email) {
                const emailExists = await new Promise((resolve) => {
                    db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userid], (err, row) => {
                        resolve(!!row && !err);
                    });
                });

                if (emailExists) {
                    return reply.status(409).send({ error: 'Email already registered' });
                }
            }

            updateFields.push('email = ?');
            updateValues.push(email);
        }

        if (picture) {
            updateFields.push('picture = ?');
            updateValues.push(picture);
        }

        // Handle password update if provided
        if (newPassword) {
            // Hash the new password before storing
            const hashedNewPassword = await bcrypt.hash(newPassword, 8);
            updateFields.push('password = ?');
            updateValues.push(hashedNewPassword);
            console.log("✅ Password will be updated");
        }

        // Check if there are fields to update
        if (updateFields.length === 0) {
            return reply.status(400).send({ error: "No fields to update" });
        }

        return new Promise((resolve, reject) => {
            updateValues.push(userid);
            const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;

            console.log("🔍 Executing SQL:", query);
            console.log("🔍 With values:", updateValues);

            db.run(query, updateValues, function (err) {
                if (err) {
                    console.error("❌ Update profile error:", err.message);
                    return reject({ statusCode: 500, error: "Database error", details: err.message });
                }
                console.log("✅ Profile updated successfully. Rows affected:", this.changes);
                // After update, fetch the updated user row and return it
                db.get('SELECT id, name, email, picture, gold FROM users WHERE id = ?', [userid], (err2, row) => {
                    if (err2) {
                        console.error('❌ Error fetching updated user:', err2.message);
                        return reject({ statusCode: 500, error: 'Database error', details: err2.message });
                    }
                    // Broadcast update via Socket.IO (server-side) so all clients receive authoritative update
                    try {
                        if (io && row && row.id) {
                            const payload = { userId: row.id, name: row.name, picture: row.picture };
                            io.emit('user_profile_updated', payload);
                            io.to(`user:${row.id}`).emit('user_profile_updated', payload);
                            fastify.log && fastify.log.info && fastify.log.info('📣 Broadcasted user_profile_updated', payload);
                        }
                    } catch (e) {
                        console.error('Error broadcasting profile update:', e);
                    }

                    // Reply with the updated user object
                    resolve(row);
                });
            });
        });
    });
}