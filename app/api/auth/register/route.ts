import { NextRequest, NextResponse } from 'next/server';
import { register, createSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }
    if (username.length < 3 || username.length > 20) {
      return NextResponse.json({ error: 'Username must be 3–20 characters' }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }

    const user = await register(username.trim(), password);
    const cookieValue = createSessionCookie(user);

    const res = NextResponse.json({ userId: user.id, username: user.username }, { status: 201 });
    res.cookies.set('ipl-session', cookieValue, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
