import { NextRequest, NextResponse } from 'next/server';
import { resetPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password required' }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
  }

  const ok = await resetPassword(token, password);
  if (!ok) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
