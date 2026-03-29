import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getTournament } from '@/lib/store';
import Header from '@/components/layout/Header';
import TournamentRoom from '@/components/tournament/TournamentRoom';

export const dynamic = 'force-dynamic';

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cookieStore = await cookies();
  const session = getSession(cookieStore.get('ipl-session')?.value);
  if (!session) redirect('/');

  const tournament = await getTournament(code);
  if (!tournament) notFound();

  // Check user is a participant
  const isMember = Object.values(tournament.teams).some(t => t.userId === session.userId);
  if (!isMember) {
    redirect('/dashboard');
  }

  const isHost = tournament.createdBy === session.userId;

  return (
    <div className="min-h-screen">
      <Header username={session.username} />
      <TournamentRoom
        code={code}
        tournamentName={tournament.name}
        isHost={isHost}
        userId={session.userId}
        initialTeams={tournament.teams}
        initialAuctionState={tournament.auctionState}
        initialPlayers={tournament.players}
        initialClosed={tournament.closed ?? false}
      />
    </div>
  );
}
