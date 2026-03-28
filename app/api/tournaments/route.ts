import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createTournament, listTournaments, serializeTournament } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tournaments = listTournaments().map(serializeTournament);
  return NextResponse.json(tournaments);
}

export async function POST(req: NextRequest) {
  const session = getSession(req.cookies.get('ipl-session')?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, teamBudget, maxTeams } = await req.json();
    if (!name || !teamBudget) {
      return NextResponse.json({ error: 'Name and teamBudget required' }, { status: 400 });
    }

    const budget = Number(teamBudget);
    const teams = Number(maxTeams) || 8;
    if (isNaN(budget) || budget < 50 || budget > 1000) {
      return NextResponse.json({ error: 'teamBudget must be 50–1000 million' }, { status: 400 });
    }

    const tournament = createTournament(session.userId, name.trim(), budget, teams);
    return NextResponse.json(serializeTournament(tournament), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create tournament';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
