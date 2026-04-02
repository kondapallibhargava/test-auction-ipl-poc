import { NextRequest, NextResponse } from 'next/server';

const SECRET = process.env.SESSION_SECRET ?? 'dev-only-insecure-secret';

async function getSessionFromCookie(cookieValue: string | undefined): Promise<{ isAdmin: boolean } | null> {
  if (!cookieValue) return null;

  const dotIndex = cookieValue.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const payload = cookieValue.slice(0, dotIndex);
  const sig = cookieValue.slice(dotIndex + 1);
  if (!payload || !sig) return null;

  // Verify HMAC using Web Crypto API (Edge-compatible)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (expected !== sig) return null;

  try {
    const session = JSON.parse(atob(payload));
    if (!session.userId || !session.username) return null;
    return { isAdmin: session.isAdmin === true };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiRoute = pathname.startsWith('/api/');

  const session = await getSessionFromCookie(req.cookies.get('ipl-session')?.value);

  if (!session) {
    return isApiRoute
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/', req.url));
  }

  if (!session.isAdmin) {
    return isApiRoute
      ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      : NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
};
