import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { leaveTournament } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = getSession(req.cookies.get('ipl-session')?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code } = await params;

  try {
    await leaveTournament(session.userId, code);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to leave tournament';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
