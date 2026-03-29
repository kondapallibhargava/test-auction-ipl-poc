import { NextResponse } from 'next/server';
import { getPlayers } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const players = await getPlayers();
  return NextResponse.json(players);
}
