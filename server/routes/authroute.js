import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { generateVerificationToken, sendVerificationEmail, sendPasswordResetEmail, isTokenExpired } from '../utils/emailService.js';

const SECRET = process.env.JWT_SECRET;
const {           
    CLIENT_URL              
} = process.env;
function sign(id) {
    return jwt.sign({ userId: id }, SECRET, { expiresIn: '7d' });
}

const SchemaRegister =
{
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
        name: { type: 'string', minLength: 1, maxLength: 16 },  
        email: { type: 'string', format: 'email', maxLength: 50 },   
        password: { type: 'string', minLength: 6, maxLength: 16 }   
    },
}

const SchemaForgotPassword = {
    type: 'object',
    required: ['email'],
    properties: {
        email: { type: 'string', format: 'email', maxLength: 36 }
    },
}

const SchemaResetPassword = {
    type: 'object',
    required: ['token', 'newPassword'],
    properties: {
        token: { type: 'string', minLength: 1 },
        newPassword: { type: 'string', minLength: 6, maxLength: 16 }
    },
}

export default async function authRoutes(fastify, opts) {

    const db = opts.db;

    fastify.post('/login', async (req, reply) => {
        const { email, password } = req.body;

        if (!email || !password) return reply.status(400).send({ error: 'Email and password are required' });

        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {

                if (err) {
                    reply.status(503).send({ error: 'Database error' });
                    return reject(err);
                }

                if (row) {
                    if (!row.password) {
                        reply.status(401).send({
                            error: 'This account uses Google sign-in. Please sign in with Google.'
                        });
                        return resolve();
                    }
                    if (row.email_verified === 0) {
                        reply.status(403).send({
                            error: 'Please verify your email before logging in. Check your inbox for the verification link.'
                        });
                        return resolve();
                    }
                    const passwordMatch = bcrypt.compareSync(password, row.password);
                    if (!passwordMatch) {
                        reply.status(401).send({ error: 'Invalid credentials' });
                        return resolve();
                    }
                    const token = sign(row.id.toString());

                    reply.setCookie('token', token, {
                        path: '/',
                        maxAge: 7 * 24 * 60 * 60,
                        httpOnly: true,
                        secure: false,  
                        sameSite: 'lax',
                    });
                    reply.send({ 
                        success: true,
                        message: 'Login successful',
                        user: {
                            id: row.id,
                            name: row.name,
                            email: row.email,
                            picture: row.picture
                        }
                    });
                    resolve(row);
                }
                else {
                    reply.status(404).send({ error: 'User not found' });
                    resolve();
                }
            });
        });
    });

   
    fastify.get('/me', async (request, reply) => {
        let token = request.headers.authorization?.split(' ')[1];
        if (!token && request.cookies) {
            token = request.cookies.token;
        }
        if (!token) return reply.status(401).send({ error: 'Unauthorized' });
        try {
            const decoded = jwt.verify(token, SECRET);
            return new Promise((resolve, reject) => {
                db.get(`SELECT * FROM users WHERE id = ?`, [decoded.userId || decoded.id], (err, row) => {
                    if (err) {
                        reply.status(503).send({ error: 'Database error' });
                        return reject(err);
                    }

                    if (row) {
                        reply.send({
                            id: row.id,
                            name: row.name,
                            picture: row.picture,
                            gold: row.gold,
                            rps_wins: row.rps_wins,
                            rps_losses: row.rps_losses,
                            rps_draws: row.rps_draws,
                            tounaments_won: row.tounaments_won
                        });
                        resolve(row);
                    } else {
                        reply.status(404).send({ error: 'User not found' });
                    }
                });
            });
        } catch (err) {
            console.error('JWT verification error:', err);
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });
    fastify.post('/logout', async (request, reply) => {
        let token = request.headers.authorization?.split(' ')[1];
        if (!token && request.cookies) {
            token = request.cookies.token;
        }
        if (token) {
            return new Promise((resolve, reject) => {
                db.run('INSERT OR IGNORE INTO blacklist_tokens (token) VALUES (?)', [token], (err) => {
                    if (err) {
                        console.error('Error blacklisting token:', err.message);
                        reply.status(503).send({ error: 'Failed to logout' });
                        return reject(err);
                    }
                    reply.setCookie('token', '', {
                        path: '/',
                        maxAge: 0,
                        httpOnly: true,
                        secure: false,
                        sameSite: 'lax',
                    });

                    reply.send({ success: true, message: 'Logged out successfully' });
                    resolve();
                });
            });
        }
        reply.setCookie('token', '', {
            path: '/',
            maxAge: 0,
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
        });

        reply.send({ success: true, message: 'Logged out successfully' });
    });
    fastify.post("/users", SchemaRegister, async (req, reply) => {
        const { name, email, password } = req.body;
        if (!name || !email || !password)
            return reply.status(400).send({ error: " Name, email and password are required" });
        const nameExists = await new Promise((resolve) => {
            db.get('SELECT id FROM users WHERE name = ?', [name], (err, row) => {
                resolve(!!row && !err);
            });
        });

        if (nameExists) {
            return reply.status(409).send({ error: 'Username already taken' });
        }
        const emailExists = await new Promise((resolve) => {
            db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
                resolve(!!row && !err);
            });
        });

        if (emailExists) {
            return reply.status(409).send({ error: 'Email already registered' });
        }
        const hashedPassword = await bcrypt.hash(password, 8);
        const verificationToken = generateVerificationToken();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (name, email, password, gold, email_verified, verification_token) VALUES (?, ?, ?, ?, ?, ?)`,
                [name, email, hashedPassword, 100, 0, verificationToken],
                function (err) {
                    if (err) {
                        console.error("Insert user error:", err.message);
                        reply.status(503).send({ error: "Database error" });
                        return reject(err);
                    }
                    const userId = this.lastID;
                    sendVerificationEmail(email, verificationToken, name)
                        .catch((err) => {
                            console.error('Failed to send verification email:', err.message);
                        });
                    db.all(`SELECT id, type FROM skins WHERE price = 0 ORDER BY id`, [], (err, freeSkins) => {
                        const selectedTypes = new Set();
                        let completed = 0;

                        freeSkins.forEach((skin) => {
                            let selected = 0;
                            if (!selectedTypes.has(skin.type)) {
                                selectedTypes.add(skin.type);
                                selected = 1;
                            }
                            db.run(`INSERT OR IGNORE INTO player_skins (player_id, skin_id, selected) VALUES (?, ?, ?)`, 
                                [userId, skin.id, selected], 
                                function(err) {
                                    if (err) {
                                        console.error(`Error inserting skin ${skin.id}:`, err.message);
                                    }
                                    completed++;
                                }
                            );
                        });
                    });
                    reply.status(201).send({
                        success: true,
                        message: 'Registration successful! Please check your email to verify your account before logging in.',
                        userId: this.lastID
                    });
                    resolve();
                }
            );
        });
    });
    fastify.get("/verify-email", async (req, reply) => {
        const { token } = req.query;

        if (!token) {
            return reply.status(400).send({ error: 'Verification token is required' });
        }

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT id, name, email, verification_token FROM users WHERE verification_token LIKE ?`,
                [token.split('.')[0] + '.%'], 
                (err, user) => {
                    if (err) {
                        console.error("Database error:", err.message);
                        reply.status(503).send({ error: 'Database error' });
                        return reject(err);
                    }

                    if (!user) {
                        return reply.status(400).send({ error: 'Invalid or expired verification token' });
                    }

                    if (isTokenExpired(user.verification_token)) {
                        return reply.status(400).send({ error: 'Verification token has expired. Please request a new one.' });
                    }

                    db.run(
                        `UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?`,
                        [user.id],
                        (err) => {
                            if (err) {
                                console.error("Error updating user:", err.message);
                                reply.status(503).send({ error: 'Failed to verify email' });
                                return reject(err);
                            }

                            reply.send({
                                success: true,
                                message: 'Email verified successfully! You can now login.',
                                name: user.name
                            });
                            resolve();
                        }
                    );
                }
            );
        });
    });

    fastify.post('/forgot-password', { schema: { body: SchemaForgotPassword } }, async (req, reply) => {
        const { email } = req.body;

        if (!email) {
            return reply.status(400).send({ error: 'Email is required' });
        }

        return new Promise((resolve, reject) => {
            db.get(`SELECT id, name, password FROM users WHERE email = ?`, [email], async (err, user) => {
                if (err) {
                    console.error('Database error:', err);
                    reply.status(503).send({ error: 'Database error' });
                    return reject(err);
                }

                if (!user) {
                    return reply.status(404).send({ 
                        error: 'No account found with this email address.'
                    });
                }
                if (!user.password) {
                    return reply.status(400).send({
                        error: 'This account was created with Google Sign-In, so no password exists. Please sign in with Google.'
                    });
                }
                const resetToken = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1h' });
                const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); 
                db.run(`DELETE FROM password_reset_tokens WHERE user_id = ?`, [user.id], async (err) => {
                    if (err) {
                        console.error('Error deleting old tokens:', err);
                        reply.status(503).send({ error: 'Database error' });
                        return reject(err);
                    }
                    db.run(
                        `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
                        [user.id, resetToken, expiresAt],
                        async (err) => {
                            if (err) {
                                console.error('Error storing reset token:', err);
                                reply.status(503).send({ error: 'Database error' });
                                return reject(err);
                            }
                            const emailSent = await sendPasswordResetEmail(email, resetToken, user.name);
                            
                            if (emailSent) {
                                reply.send({
                                    success: true,
                                    message: 'Password reset link has been sent to your email.'
                                });
                            } else {
                                reply.status(502).send({
                                    error: 'Failed to send reset email. Please try again later.'
                                });
                            }
                            resolve();
                        }
                    );
                });
            });
        });
    });

    fastify.post('/reset-password', { schema: { body: SchemaResetPassword } }, async (req, reply) => {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return reply.status(400).send({ error: 'Token and new password are required' });
        }

        try {
            const decoded = jwt.verify(token, SECRET);
            const userId = decoded.userId;
            return new Promise((resolve, reject) => {
                db.get(
                    `SELECT * FROM password_reset_tokens WHERE token = ? AND user_id = ? AND expires_at > datetime('now')`,
                    [token, userId],
                    async (err, resetToken) => {
                        if (err) {
                            console.error('Database error:', err);
                            reply.status(503).send({ error: 'Database error' });
                            return reject(err);
                        }

                        if (!resetToken) {
                            return reply.status(400).send({ 
                                error: 'Invalid or expired reset token' 
                            });
                        }

                        db.get(`SELECT id, password FROM users WHERE id = ?`, [userId], async (err, user) => {
                            if (err) {
                                console.error('Database error:', err);
                                reply.status(503).send({ error: 'Database error' });
                                return reject(err);
                            }

                            if (!user) {
                                return reply.status(400).send({ 
                                    error: 'User account no longer exists' 
                                });
                            }

                            if (user.password === null) {
                                return reply.status(400).send({
                                    error: 'This account was created with Google Sign-In, so no password exists. Please sign in with Google.'
                                });
                            }

                            const hashedPassword = await bcrypt.hash(newPassword, 8);

                            db.run(
                                `UPDATE users SET password = ? WHERE id = ?`,
                                [hashedPassword, userId],
                                function(err) {
                                    if (err) {
                                        console.error('Error updating password:', err);
                                        reply.status(503).send({ error: 'Database error' });
                                        return reject(err);
                                    }

                                    if (this.changes === 0) {
                                        console.error('Password update affected 0 rows');
                                        reply.status(422).send({ error: 'Failed to update password' });
                                        return reject(new Error('No rows updated'));
                                    }

                                    db.run(
                                        `DELETE FROM password_reset_tokens WHERE token = ?`,
                                        [token],
                                        (err) => {
                                            if (err) {
                                                console.error('Error deleting reset token:', err);
                                            }

                                            reply.send({
                                                success: true,
                                                message: 'Password has been reset successfully'
                                            });
                                            resolve();
                                        }
                                    );
                                }
                            );
                        });
                    }
                );
            });
        } catch (err) {
            console.error('Token verification error:', err);
            return reply.status(400).send({ error: 'Invalid or expired reset token' });
        }
    });

}