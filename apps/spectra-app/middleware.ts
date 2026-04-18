import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? '');
}

function extractToken(request: NextRequest): string | null {
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return request.cookies.get('__spectra_token')?.value ?? null;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (
    pathname === '/' ||
    pathname.startsWith('/auth') ||
    pathname === '/api/auth/token' ||
    pathname.startsWith('/api/inngest')
  ) {
    return NextResponse.next();
  }

  const token = extractToken(request);
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Missing token', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid token', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/upload', '/api/job/:path*'],
};
