import jwt from 'jsonwebtoken';

// Load environment variables from .env file
const {
  GOOGLE_CLIENT_ID,        // Google app ID from Cloud Console
  GOOGLE_CLIENT_SECRET,    // Google app secret key
  JWT_SECRET,              // Our secret key for signing tokens
  REDIRECT_URI,            // Where Google sends users back to
  CLIENT_URL               // Our frontend URL
} = process.env;

// Check if all required variables are set - crash early if missing
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET) {
  throw new Error('Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or JWT_SECRET');
}

export default async function googleAuth(fastify, opts) {
  const db = opts.db;

  // STEP 1: Start Google OAuth Flow
  // When user clicks "Sign in with Google", redirect them to Google's login page
  fastify.get('/auth/google', async (request, reply) => {
    // Google's OAuth authorization endpoint
    const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth';

    // Build URL parameters for Google
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,           // Tell Google who we are
      redirect_uri: REDIRECT_URI,            // Where to send user after login
      response_type: 'code',                 // We want an authorization code
      scope: 'profile email',                // We want user's name, email, and picture
      access_type: 'offline',                // Can refresh token when user is offline
      prompt: 'consent'                      // Always show consent screen
    });

    // Send user to Google's login page
    reply.redirect(`${googleAuthUrl}?${params.toString()}`);
  });

  // STEP 2: Handle Google's Response
  // Google sends user back here with an authorization code
  fastify.get('/auth/google/callback', async (request, reply) => {
    // Get the authorization code from URL
    const { code } = request.query;

    // If no code, something went wrong - send user back to login
    if (!code) {
      return reply.redirect(`${CLIENT_URL}/login?error=no_code`);
    }

    try {

      // STEP 3: Exchange Code for Access Token
      // Trade the authorization code for an access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,                                // The authorization code from Google
          client_id: GOOGLE_CLIENT_ID,         // Our app ID
          client_secret: GOOGLE_CLIENT_SECRET, // Our app secret (never send to client!)
          redirect_uri: REDIRECT_URI,          // Must match what we registered
          grant_type: 'authorization_code'     // Type of OAuth flow
        })
      });

      const tokens = await tokenResponse.json();

      // If we didn't get an access token, something went wrong
      if (!tokens.access_token) {
        return reply.redirect(`${CLIENT_URL}/login?error=no_access_token`);
      }


      // STEP 4: Get User Information from Google
      // Use the access token to fetch user's profile data
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      const profile = await userInfoResponse.json();

      // Extract user data from Google profile
      const email = profile.email;
      const name = profile.name || 'Google User';
      const picture = profile.picture || null;


      // STEP 5: Create or Update User in Database
      // Check if user already exists or create new account
      return new Promise((resolve, reject) => {
        // Look for existing user by email
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
          if (err) {
            console.error('Database error:', err);
            reply.redirect(`${CLIENT_URL}/login?error=db_error`);
            return reject(err);
          }

          if (user) {

            // User Already Exists - Update & Login
            // Only update picture if user hasn't uploaded a custom one
            // (custom pictures don't start with https://lh3.googleusercontent.com)
            const isGooglePicture = user.picture && user.picture.startsWith('https://lh3.googleusercontent.com');
            if (picture && isGooglePicture && user.picture !== picture) {
              db.run('UPDATE users SET picture = ? WHERE id = ?', [picture, user.id]);
            }

            // Create JWT token for this user (valid for 7 days)
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

            // Set token as HTTP cookie (more secure - not in URL)
            reply.setCookie('token', token, {
              path: '/',
              maxAge: 7 * 24 * 60 * 60,
              httpOnly: true,
              secure: false,  // nginx handles HTTPS, backend is HTTP
              sameSite: 'lax',
            });

            // Redirect to home page (token already in cookie)
            reply.redirect(`${CLIENT_URL}/home`);
            resolve(user);
          } else {

            // New User - Create Account

            db.run(
              'INSERT INTO users (name, email, picture, password, gold) VALUES (?, ?, ?, ?, ?)',
              [name, email, picture, null, 100],  // password is null (OAuth user), give 100 gold
              function (err) {
                if (err) {
                  console.error('Insert error:', err);
                  reply.redirect(`${CLIENT_URL}/login?error=insert_failed`);
                  return reject(err);
                }

                // Create JWT token for new user (valid for 7 days)
                const token = jwt.sign({ userId: this.lastID }, JWT_SECRET, { expiresIn: '7d' });

                // Set token as HTTP cookie (more secure - not in URL)
                reply.setCookie('token', token, {
                  path: '/',
                  maxAge: 7 * 24 * 60 * 60,
                  httpOnly: true, // must be true for auth
                  secure: false,  // nginx handles HTTPS, backend is HTTP
                  sameSite: 'lax', // prevents accidental removal
                });

                const userId = this.lastID;
                db.all(`SELECT id, type FROM skins WHERE price = 0 ORDER BY id`, [], (err, freeSkins) => {
                    

                    console.log(`Found ${freeSkins.length} free skins for user ${userId}`);


                    const selectedTypes = new Set();
                    let completed = 0;

                    freeSkins.forEach((skin) => {
                        let selected = 0;
                    
                        // Select the first skin of each type (table, paddle, ball)
                        if (!selectedTypes.has(skin.type)) {
                            selectedTypes.add(skin.type);
                            selected = 1;
                            console.log(`Selecting skin ${skin.id} (${skin.type}) for user ${userId}`);
                        }
                      
                        // Insert each skin directly
                        db.run(`INSERT OR IGNORE INTO player_skins (player_id, skin_id, selected) VALUES (?, ?, ?)`, 
                            [userId, skin.id, selected], 
                            function(err) {
                                if (err) {
                                    console.error(`Error inserting skin ${skin.id}:`, err.message);
                                } else {
                                    console.log(`Inserted skin ${skin.id} for user ${userId}, selected: ${selected}`);
                                }
                                completed++;
                              
                            }
                        );
                    });
                });
                reply.redirect(`${CLIENT_URL}/home`);
                resolve({ id: this.lastID, name, email, picture });
              }
            );
          }
        });
      });
    } catch (error) {
      // If anything goes wrong, send user back to login with error
      console.error('OAuth error:', error);
      reply.redirect(`${CLIENT_URL}/login?error=oauth_failed`);
    }
  });
}
