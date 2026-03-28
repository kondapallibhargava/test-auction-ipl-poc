import { NextResponse } from 'next/server';
import { SEEDED_PLAYERS } from '@/lib/seed';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(SEEDED_PLAYERS);
}
