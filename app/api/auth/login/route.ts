import { NextRequest, NextResponse } from 'next/server';
import { login, createSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const user = await login(username.trim(), password);
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const cookieValue = createSessionCookie(user);
    const res = NextResponse.json({ userId: user.id, username: user.username });
    res.cookies.set('ipl-session', cookieValue, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
