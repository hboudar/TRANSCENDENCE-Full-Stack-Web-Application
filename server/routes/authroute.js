import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { generateVerificationToken, sendVerificationEmail, isTokenExpired } from '../utils/emailService.js';

// Use same JWT secret as Google OAuth (IMPORTANT: must match!)
const SECRET = process.env.JWT_SECRET;
const {           // Where Google sends users back to
    CLIENT_URL               // Our frontend URL
} = process.env;
// Helper function to create JWT token for a user (valid for 7 days)
function sign(id) {
    return jwt.sign({ userId: id }, SECRET, { expiresIn: '7d' });
}

// Validation schema for user registration
const SchemaRegister =
{
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
        name: { type: 'string', minLength: 1, maxLength: 16 },  // Max 50 characters
        email: { type: 'string', format: 'email', maxLength: 36 },  // Must be valid email, max 100 chars
        password: { type: 'string', minLength: 6, maxLength: 16 }   // 6-128 characters
    },
}

export default async function authRoutes(fastify, opts) {

    const db = opts.db;

    // Traditional email/password login Endpoint (NOT for Google OAuth users)
    fastify.post('/login', async (req, reply) => {
        const { email, password } = req.body;

        // Check if both email and password provided
        if (!email || !password) return reply.status(400).send({ error: 'Email and password are required' });

        return new Promise((resolve, reject) => {
            // Find user by email
            db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {

                if (err) {
                    reply.status(500).send({ error: 'Database error' });
                    return reject(err);
                }

                if (row) {
                    // IMPORTANT: Check if user signed up with Google
                    // Google OAuth users have null password - they can't login with password
                    if (!row.password) {
                        return reply.status(401).send({
                            error: 'This account uses Google sign-in. Please sign in with Google.'
                        });
                    }

                    // Check if email is verified (only for email/password users)
                    if (row.email_verified === 0) {
                        return reply.status(403).send({
                            error: 'Please verify your email before logging in. Check your inbox for the verification link.'
                        });
                    }

                    // Verify password matches hashed password in database
                    const passwordMatch = bcrypt.compareSync(password, row.password);
                    if (!passwordMatch) {
                        return reply.status(401).send({ error: 'Invalid credentials' });
                    }

                    // Password correct - generate JWT token (valid for 7 days)
                    const token = sign(row.id.toString());

                    reply.setCookie('token', token, {
                        path: '/',
                        maxAge: 7 * 24 * 60 * 60,
                        httpOnly: true,
                        secure: false,  // nginx handles HTTPS, backend is HTTP
                        sameSite: 'lax',
                    });

                    // Send success response (frontend will handle redirect)
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
                    // No user found with this email
                    reply.status(404).send({ error: 'User not found' });
                }
            });
        });
    });

    // Token Verification Endpoint (/me)
    // Used by UserContext to verify JWT token and get user data
    // Checks both Authorization header and cookies for token
    fastify.get('/me', async (request, reply) => {
        // Try to get token from Authorization header first, then from cookies
        let token = request.headers.authorization?.split(' ')[1];
        if (!token && request.cookies) {
            token = request.cookies.token;
        }

        // No token found - user not authenticated
        if (!token) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            // Verify token signature and check if not expired
            const decoded = jwt.verify(token, SECRET);

            return new Promise((resolve, reject) => {
                // Get user data from database using ID from token
                db.get(`SELECT * FROM users WHERE id = ?`, [decoded.userId || decoded.id], (err, row) => {
                    if (err) {
                        reply.status(500).send({ error: 'Database error' });
                        return reject(err);
                    }

                    if (row) {
                        // User found - send data back to client
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
                        // User ID in token doesn't exist in database (orphaned token)
                        reply.status(404).send({ error: 'User not found' });
                    }
                });
            });
        } catch (err) {
            // Token signature invalid or token expired
            console.error('JWT verification error:', err);
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    // Logout Endpoint
    // Clears the authentication cookie and blacklists the token
    fastify.post('/logout', async (request, reply) => {
        // Get token from Authorization header or cookies
        let token = request.headers.authorization?.split(' ')[1];
        if (!token && request.cookies) {
            token = request.cookies.token;
        }

        // If token exists, add it to blacklist
        if (token) {
            return new Promise((resolve, reject) => {
                db.run('INSERT OR IGNORE INTO blacklist_tokens (token) VALUES (?)', [token], (err) => {
                    if (err) {
                        console.error('Error blacklisting token:', err.message);
                        reply.status(500).send({ error: 'Failed to logout' });
                        return reject(err);
                    }

                    // Clear the token cookie
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

        // No token to blacklist, just clear cookie
        reply.setCookie('token', '', {
            path: '/',
            maxAge: 0,
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
        });

        reply.send({ success: true, message: 'Logged out successfully' });
    });

    // User Registration Endpoint
    // Creates new user account with email/password (NOT for Google OAuth)
    fastify.post("/users", SchemaRegister, async (req, reply) => {
        const { name, email, password } = req.body;
        if (!name || !email || !password)
            return reply.status(400).send({ error: " Name, email and password are required" });

        // Check if name already exists
        const nameExists = await new Promise((resolve) => {
            db.get('SELECT id FROM users WHERE name = ?', [name], (err, row) => {
                resolve(!!row && !err);
            });
        });

        if (nameExists) {
            return reply.status(409).send({ error: 'Username already taken' });
        }

        // Check if email already exists
        const emailExists = await new Promise((resolve) => {
            db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
                resolve(!!row && !err);
            });
        });

        if (emailExists) {
            return reply.status(409).send({ error: 'Email already registered' });
        }

        // Hash password before storing (never store plain text passwords!)
        const hashedPassword = await bcrypt.hash(password, 8);

        // Generate verification token
        const verificationToken = generateVerificationToken();

        return new Promise((resolve, reject) => {
            // Create new user in database with 100 starting gold and verification token
            db.run(
                `INSERT INTO users (name, email, password, gold, email_verified, verification_token) VALUES (?, ?, ?, ?, ?, ?)`,
                [name, email, hashedPassword, 100, 0, verificationToken],
                function (err) {
                    if (err) {
                        console.error("Insert user error:", err.message);
                        reply.status(500).send({ error: "Database error" });
                        return reject(err);
                    }
                    // Give new user default skins (3 selected, 3 locked)
                    const userId = this.lastID;

                    // Send verification email
                    sendVerificationEmail(email, verificationToken, name)
                        .catch((err) => {
                            console.error('Failed to send verification email:', err.message);
                        });
                    db.all(`SELECT id, type FROM skins WHERE price = 0 ORDER BY id`, [], (err, freeSkins) => {
                        

                        const selectedTypes = new Set();
                        let completed = 0;

                        freeSkins.forEach((skin) => {
                            let selected = 0;
                        
                            // Select the first skin of each type (table, paddle, ball)
                            if (!selectedTypes.has(skin.type)) {
                                selectedTypes.add(skin.type);
                                selected = 1;
                            }
                        
                            // Insert each skin directly
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
                    
                    // Return success message telling user to check email
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

    // Email Verification Endpoint
    // Verifies user email using token sent in verification email
    fastify.get("/verify-email", async (req, reply) => {
        const { token } = req.query;

        if (!token) {
            return reply.status(400).send({ error: 'Verification token is required' });
        }

        return new Promise((resolve, reject) => {
            // Find user with matching verification token
            db.get(
                `SELECT id, name, email, verification_token FROM users WHERE verification_token LIKE ?`,
                [token.split('.')[0] + '.%'], // Match token part before timestamp
                (err, user) => {
                    if (err) {
                        console.error("Database error:", err.message);
                        reply.status(500).send({ error: 'Database error' });
                        return reject(err);
                    }

                    if (!user) {
                        return reply.status(400).send({ error: 'Invalid or expired verification token' });
                    }

                    // Check if token is expired (5 minutes)
                    if (isTokenExpired(user.verification_token)) {
                        return reply.status(400).send({ error: 'Verification token has expired. Please request a new one.' });
                    }

                    // Mark email as verified and clear token
                    db.run(
                        `UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?`,
                        [user.id],
                        (err) => {
                            if (err) {
                                console.error("Error updating user:", err.message);
                                reply.status(500).send({ error: 'Failed to verify email' });
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

}