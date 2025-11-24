import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// List of routes that require authentication
const protectedRoutes = [
  "/home",
  "/dashboard",
  "/shop",
  "/profile",
  "/chat",
  "/settings",
  "/cart",
  "/orders",
  "/rps",
  "/games",
  "/profile/*",
];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const pathname = request.nextUrl.pathname;

  // If accessing protected route without token → redirect to login
  if ((protectedRoutes.includes(pathname) || pathname.startsWith("/profile/"))
   && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Token exists or route not protected → allow access
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
