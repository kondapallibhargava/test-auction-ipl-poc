import { NextRequest, NextResponse } from 'next/server';
import { getSseClients, getTournament, serializeTeams } from '@/lib/store';
import { getSession } from '@/lib/auth';

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

  const clients = getSseClients();
  if (!clients.has(code)) {
    clients.set(code, new Set());
  }

  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
      clients.get(code)!.add(controller);

      // Send current state immediately on connect (catches up anyone who
      // missed broadcast events while loading or reconnecting)
      const initialData = JSON.stringify({
        type: 'state_update',
        payload: {
          auctionState: tournament.auctionState,
          teams: serializeTeams(tournament),
        },
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(new TextEncoder().encode(`data: ${initialData}\n\n`));

      // Heartbeat every 25s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        clients.get(code)?.delete(controller);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
