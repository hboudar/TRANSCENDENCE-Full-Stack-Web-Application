import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/', '/login', '/register'];
const PROTECTED_ROUTES = ['/home', '/chat', '/games', '/shop', '/friends', '/rps'];

// Verify token by calling backend API directly (not through nginx)
async function verifyToken(token: string): Promise<boolean> {
  try {
    // Call backend server using Docker internal network (server:4000)
    // This works because middleware runs server-side in Next.js container
    const response = await fetch('http://server:4000/me', {
      headers: {
        'Cookie': `token=${token}`
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('[Middleware] Token verification failed:', error);
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const pathname = req.nextUrl.pathname;

  console.log('[Middleware]', {
    pathname,
    hasToken: !!token,
    tokenPreview: token ? `${token.substring(0, 20)}...` : 'none'
  });

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const isProtected = PROTECTED_ROUTES.includes(pathname) || pathname.startsWith('/profile');

  // Verify token with backend if it exists
  const hasValidToken = token ? await verifyToken(token) : false;

  console.log('[Middleware]', {
    pathname,
    isPublic,
    isProtected,
    hasValidToken
  });

  // 1️⃣ Non-logged users (no token or invalid token) trying to access protected pages → redirect to login
  if (!hasValidToken && isProtected) {
    console.log('[Middleware] Redirecting to /login - no valid token for protected route');
    const response = NextResponse.redirect(new URL('/login', req.url));
    // Clear invalid token if exists
    if (token) {
      response.cookies.delete('token');
    }
    return response;
  }

  // 2️⃣ Logged users (valid token) trying to access login/register → redirect to home
  if (hasValidToken && isPublic && pathname !== '/') {
    console.log('[Middleware] Redirecting to /home - valid token on public route');
    return NextResponse.redirect(new URL('/home', req.url));
  }

  console.log('[Middleware] Allowing request to proceed');
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/register',
    '/home',
    '/chat',
    '/games',
    '/shop',
    '/friends',
    '/rps',
    '/profile/:path*'
  ],
};
