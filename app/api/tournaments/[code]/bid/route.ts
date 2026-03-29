import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { placeBid } from '@/lib/store';

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
    const { amount } = await req.json();
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Valid bid amount required' }, { status: 400 });
    }

    const bid = await placeBid(code, session.userId, amount);
    return NextResponse.json(bid, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bid failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
