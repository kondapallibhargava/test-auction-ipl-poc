import { NextRequest, NextResponse } from 'next/server';
import { getTournament, serializeTournament } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const tournament = await getTournament(code);
  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }
  return NextResponse.json(serializeTournament(tournament));
}
