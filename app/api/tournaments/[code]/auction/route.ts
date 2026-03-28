import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { startAuction, markSold, markUnsold, resetAuction, rerunUnsoldAuction, closeAuction } from '@/lib/store';

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
    const { action } = await req.json();

    let state;
    switch (action) {
      case 'start':
        state = startAuction(code, session.userId);
        break;
      case 'sold':
        state = markSold(code, session.userId);
        break;
      case 'unsold':
        state = markUnsold(code, session.userId);
        break;
      case 'reset':
        state = resetAuction(code, session.userId);
        break;
      case 'rerun':
        state = rerunUnsoldAuction(code, session.userId);
        break;
      case 'close':
        state = closeAuction(code, session.userId);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auction action failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
