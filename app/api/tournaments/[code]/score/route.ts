import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTournament, importMatch } from '@/lib/store';
import { getSampleScorecard, fetchFromESPNCricinfo } from '@/lib/scorecard';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = getSession(req.cookies.get('ipl-session')?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code } = await params;
  const tournament = getTournament(code);
  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  return NextResponse.json({ matchResults: tournament.matchResults ?? [] });
}

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
    const { source, url } = await req.json();

    let match;
    if (source === 'sample') {
      match = getSampleScorecard();
    } else if (source === 'url') {
      match = await fetchFromESPNCricinfo(url ?? '');
    } else {
      return NextResponse.json({ error: 'Invalid source. Use "sample" or "url".' }, { status: 400 });
    }

    const matchResult = importMatch(code, session.userId, match);
    return NextResponse.json({ matchResult });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to import match';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
