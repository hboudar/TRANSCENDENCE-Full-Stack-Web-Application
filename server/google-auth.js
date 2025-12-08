import jwt from 'jsonwebtoken';


const {
  GOOGLE_CLIENT_ID,        
  GOOGLE_CLIENT_SECRET,    
  JWT_SECRET,              
  REDIRECT_URI,            
  CLIENT_URL               
} = process.env;


if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET) {
  throw new Error('Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or JWT_SECRET');
}

export default async function googleAuth(fastify, opts) {
  const db = opts.db;

  
  
  fastify.get('/auth/google', async (request, reply) => {
    
    const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth';

    
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,           
      redirect_uri: REDIRECT_URI,            
      response_type: 'code',                 
      scope: 'profile email',                
      access_type: 'offline',                
      prompt: 'consent'                      
    });

    
    reply.redirect(`${googleAuthUrl}?${params.toString()}`);
  });

  
  
  fastify.get('/auth/google/callback', async (request, reply) => {
    
    const { code } = request.query;

    
    if (!code) {
      return reply.redirect(`${CLIENT_URL}/login?error=no_code`);
    }

    try {

      
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,                                
          client_id: GOOGLE_CLIENT_ID,         
          client_secret: GOOGLE_CLIENT_SECRET, 
          redirect_uri: REDIRECT_URI,          
          grant_type: 'authorization_code'     
        })
      });

      const tokens = await tokenResponse.json();

      
      if (!tokens.access_token) {
        return reply.redirect(`${CLIENT_URL}/login?error=no_access_token`);
      }


      
      
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      const profile = await userInfoResponse.json();

      
      const email = profile.email;
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const name = (profile.name || 'Google User') + randomSuffix;
      const picture = profile.picture || null;


      
      
      return new Promise((resolve, reject) => {
        
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
          if (err) {
            console.error('Database error:', err);
            reply.redirect(`${CLIENT_URL}/login?error=db_error`);
            return reject(err);
          }

          if (user) {

            
            
            
            const isGooglePicture = user.picture && user.picture.startsWith('https://lh3.googleusercontent.com');
            if (picture && isGooglePicture && user.picture !== picture) {
              db.run('UPDATE users SET picture = ? WHERE id = ?', [picture, user.id]);
            }

            
            if (user.email_verified === 0) {
              db.run('UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?', [user.id]);
            }

            
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

            
            reply.setCookie('token', token, {
              path: '/',
              maxAge: 7 * 24 * 60 * 60,
              httpOnly: true,
              secure: false,  
              sameSite: 'lax',
            });

            
            reply.redirect(`${CLIENT_URL}/home`);
            resolve(user);
          } else {

            

            db.run(
              'INSERT INTO users (name, email, picture, password, gold, email_verified) VALUES (?, ?, ?, ?, ?, ?)',
              [name, email, picture, null, 100, 1],  
              function (err) {
                if (err) {
                  console.error('Insert error:', err);
                  reply.redirect(`${CLIENT_URL}/login?error=insert_failed`);
                  return reject(err);
                }

                
                const token = jwt.sign({ userId: this.lastID }, JWT_SECRET, { expiresIn: '7d' });

                
                reply.setCookie('token', token, {
                  path: '/',
                  maxAge: 7 * 24 * 60 * 60,
                  httpOnly: true, 
                  secure: false,  
                  sameSite: 'lax', 
                });

                const userId = this.lastID;
                db.all(`SELECT id, type FROM skins WHERE price = 0 ORDER BY id`, [], (err, freeSkins) => {
                    

                    console.log(`Found ${freeSkins.length} free skins for user ${userId}`);


                    const selectedTypes = new Set();
                    let completed = 0;

                    freeSkins.forEach((skin) => {
                        let selected = 0;
                    
                        
                        if (!selectedTypes.has(skin.type)) {
                            selectedTypes.add(skin.type);
                            selected = 1;
                            console.log(`Selecting skin ${skin.id} (${skin.type}) for user ${userId}`);
                        }
                      
                        
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
      
      console.error('OAuth error:', error);
      reply.redirect(`${CLIENT_URL}/login?error=oauth_failed`);
    }
  });
}
