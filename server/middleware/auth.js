import jwt from 'jsonwebtoken';
const SECRET = process.env.JWT_SECRET;

async function verifyTokenAndUser(token, db) {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, SECRET);
    const userId = decoded.userId || decoded.id;

    return new Promise((resolve) => {
      db.get('SELECT id FROM users WHERE id = ?', [userId], (err, row) => {
        if (err || !row) return resolve(null);
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

  // Attach user to request for later use in route handlers
  req.user = userId ? { id: userId } : null;

  // Debug logging
  if (req.url === '/profile' || req.url.startsWith('/profile')) {
    console.log('🔐 Auth middleware for /profile:', {
      url: req.url,
      method: req.method,
      hasToken: !!token,
      userId,
      cookies: req.cookies,
      authHeader: req.headers.authorization
    });
  }

  // Public routes that don't need authentication
  const publicRoutes = ['/', '/login', '/register', '/users', '/auth/google', '/auth/google/callback'];
  
  if (publicRoutes.includes(req.url) || req.url.startsWith('/auth/')) {
    return; // Allow public routes
  }

  // All other routes require authentication
  if (!userId) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  // User is authenticated, continue to route handler
  return;
}
