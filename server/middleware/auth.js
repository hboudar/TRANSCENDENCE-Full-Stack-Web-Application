import jwt from 'jsonwebtoken';
const SECRET = process.env.JWT_SECRET;

async function verifyTokenAndUser(token, db) {
  if (!token) return null;

  try {
    const isBlacklisted = await new Promise((resolve) => {
      db.get('SELECT token FROM blacklist_tokens WHERE token = ?', [token], (err, row) => {
        if (err) return resolve(false);
        resolve(!!row);
      });
    });

    if (isBlacklisted) return null;

    const decoded = jwt.verify(token, SECRET);
    const userId = decoded.userId || decoded.id;
    const tokenName = decoded.name;
    const tokenEmail = decoded.email;

    return new Promise((resolve) => {
      db.get('SELECT id, name, email FROM users WHERE id = ?', [userId], (err, row) => {
        if (err || !row) return resolve(null);
        
        if (tokenName && row.name !== tokenName) {
          console.log(`⚠️ Token name mismatch for user ${userId}: token="${tokenName}" db="${row.name}"`);
          return resolve(null);
        }
        if (tokenEmail && row.email !== tokenEmail) {
          console.log(`⚠️ Token email mismatch for user ${userId}: token="${tokenEmail}" db="${row.email}"`);
          return resolve(null);
        }
        
        resolve(userId);
      });
    });
  } catch {
    return null;
  }
}

export default async function authMiddleware(req, reply, db) {
  let token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
  const userId = await verifyTokenAndUser(token, db);

  req.user = userId ? { id: userId } : null;

  console.log('Middleware - URL:', req.url, 'Method:', req.method, 'Has Token:', !!token);

  const publicRoutes = ['/', '/login', '/register', '/users', '/verify-email', '/forgot-password', '/reset-password'];
  
  const pathname = req.url.split('?')[0];
  
  if (publicRoutes.includes(pathname) || 
      pathname.startsWith('/auth/') || 
      pathname.startsWith('/games/cli/')) {
    console.log('Allowing public route:', req.url);
    return; 
  }

  if (!userId) {
    console.log('Blocking unauthenticated request to:', req.url);
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  return;
}
