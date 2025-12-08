import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/', '/login', '/register'];
const PROTECTED_ROUTES = ['/home', '/chat', '/games', '/shop', '/friends', '/rps'];

async function verifyToken(token: string): Promise<boolean> {
  try {
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

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const isProtected = PROTECTED_ROUTES.includes(pathname) || pathname.startsWith('/profile') || pathname.startsWith('/games');

  const hasValidToken = token ? await verifyToken(token) : false;

  if (!hasValidToken && isProtected) {
    const response = NextResponse.redirect(new URL('/login', req.url));
    if (token) {
      response.cookies.delete('token');
    }
    return response;
  }

  if (hasValidToken && isPublic && pathname !== '/') {
    return NextResponse.redirect(new URL('/home', req.url));
  }

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
