/**
 * JWT auth guard — protects all /dashboard routes.
 *
 * Phase 3 implementation:
 *   - Extract Bearer token from Authorization header or __spectra_token cookie.
 *   - Verify with JWT_SECRET (jose library).
 *   - Redirect to /auth/login on missing or invalid token.
 *   - Pass through on valid token.
 *
 * Public routes (no auth required): /, /auth/login, /api/auth/token
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Public routes — no auth check
  if (
    pathname === '/' ||
    pathname.startsWith('/auth') ||
    pathname === '/api/auth/token' ||
    pathname === '/api/inngest'
  ) {
    return NextResponse.next();
  }

  // Phase 3: verify JWT and redirect to /auth/login on failure
  // Placeholder: allow all requests through during scaffold phase
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/upload', '/api/job/:path*'],
};
