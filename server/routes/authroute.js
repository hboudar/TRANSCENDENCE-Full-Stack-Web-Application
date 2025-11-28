import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },  // Must be valid email
        password: { type: 'string', minLength: 6 }   // At least 6 characters
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

                    // Send token and user data back to client
                    reply.redirect(`${CLIENT_URL}/home`);
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
    // Clears the authentication cookie from the backend
    fastify.post('/logout', async (request, reply) => {
        // Clear the token cookie by setting it with an expired maxAge
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

        // Hash password before storing (never store plain text passwords!)
        const hashedPassword = await bcrypt.hash(password, 8);

        return new Promise((resolve, reject) => {
            // Create new user in database with 100 starting gold
            db.run(
                `INSERT OR IGNORE INTO users (name, email, password, gold) VALUES (?, ?, ?, ?)`,
                [name, email, hashedPassword, 100],
                function (err) {
                    if (err) {
                        console.error("Insert user error:", err.message);
                        reply.status(500).send({ error: "Database error" });
                        return reject(err);
                    }
                    // Give new user default skins (3 selected, 3 locked)
                    db.run(`INSERT OR IGNORE INTO player_skins (player_id, skin_id, selected) VALUES (?, ?, ?)`, [this.lastID, 1, 1]);
                    db.run(`INSERT OR IGNORE INTO player_skins (player_id, skin_id, selected) VALUES (?, ?, ?)`, [this.lastID, 2, 1]);
                    db.run(`INSERT OR IGNORE INTO player_skins (player_id, skin_id, selected) VALUES (?, ?, ?)`, [this.lastID, 3, 1]);
                    db.run(`INSERT OR IGNORE INTO player_skins (player_id, skin_id, selected) VALUES (?, ?, ?)`, [this.lastID, 4, 0]);
                    db.run(`INSERT OR IGNORE INTO player_skins (player_id, skin_id, selected) VALUES (?, ?, ?)`, [this.lastID, 5, 0]);
                    db.run(`INSERT OR IGNORE INTO player_skins (player_id, skin_id, selected) VALUES (?, ?, ?)`, [this.lastID, 6, 0]);
                    db.run(`INSERT OR IGNORE INTO player_skins (player_id, skin_id, selected) VALUES (?, ?, ?)`, [this.lastID, 7, 0]);
                    db.run(`INSERT OR IGNORE INTO player_skins (player_id, skin_id, selected) VALUES (?, ?, ?)`, [this.lastID, 8, 0]);
                    db.run(`INSERT OR IGNORE INTO player_skins (player_id, skin_id, selected) VALUES (?, ?, ?)`, [this.lastID, 9, 0]);
                    resolve({ id: this.lastID, name, email });
                }
            );
        });
    });

}