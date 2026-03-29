import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { joinTournament } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = getSession(req.cookies.get('ipl-session')?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code } = await params;

  try {
    const { teamName } = await req.json();
    if (!teamName) {
      return NextResponse.json({ error: 'teamName required' }, { status: 400 });
    }

    const team = await joinTournament(session.userId, code, teamName.trim());
    return NextResponse.json(team, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to join tournament';
    const status = message.includes('Already in') ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
