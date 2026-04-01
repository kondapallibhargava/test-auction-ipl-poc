import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { adminImportMatch, listTournaments } from '@/lib/store';
import { parseESPNScorecardText } from '@/lib/espn-parser';

export const dynamic = 'force-dynamic';

function isAdmin(username: string): boolean {
  const adminUsername = process.env.ADMIN_USERNAME;
  return !!adminUsername && username === adminUsername;
}

export async function POST(req: NextRequest) {
  const session = getSession(req.cookies.get('ipl-session')?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdmin(session.username)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { scorecardText, matchId, matchTitle, matchDate, venue } = await req.json();

    if (!scorecardText || !matchId || !matchTitle || !matchDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const allTournaments = await listTournaments();
    const ongoing = allTournaments.filter(t => t.status === 'completed');

    if (ongoing.length === 0) {
      return NextResponse.json({ error: 'No ongoing tournaments to apply scorecard to' }, { status: 400 });
    }

    const match = parseESPNScorecardText(scorecardText, {
      id: matchId,
      title: matchTitle,
      date: matchDate,
      venue: venue ?? undefined,
    });

    const settled = await Promise.allSettled(
      ongoing.map(t => adminImportMatch(t.code, match))
    );

    const results = ongoing.map((t, i) => {
      const outcome = settled[i];
      if (outcome.status === 'fulfilled') {
        return { tournamentCode: t.code, tournamentName: t.name, matchResult: outcome.value };
      } else {
        return { tournamentCode: t.code, tournamentName: t.name, error: outcome.reason?.message ?? 'Failed' };
      }
    });

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to import match';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
