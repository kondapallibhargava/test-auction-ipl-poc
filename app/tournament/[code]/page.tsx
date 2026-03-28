import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getTournament } from '@/lib/store';
import Header from '@/components/layout/Header';
import TournamentRoom from '@/components/tournament/TournamentRoom';
import { Team, TournamentPlayer } from '@/lib/types';

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

  const tournament = getTournament(code);
  if (!tournament) notFound();

  // Check user is a participant
  const isMember = Array.from(tournament.teams.values()).some(t => t.userId === session.userId);
  if (!isMember) {
    redirect('/dashboard');
  }

  const isHost = tournament.createdBy === session.userId;

  // Serialize teams (Maps → plain objects for client)
  const serializedTeams: Record<string, Team> = {};
  for (const [id, team] of tournament.teams) {
    serializedTeams[id] = { ...team, players: team.players };
  }

  const serializedPlayers: Record<string, TournamentPlayer> = Object.fromEntries(tournament.players);

  return (
    <div className="min-h-screen">
      <Header username={session.username} />
      <TournamentRoom
        code={code}
        tournamentName={tournament.name}
        isHost={isHost}
        userId={session.userId}
        initialTeams={serializedTeams}
        initialAuctionState={tournament.auctionState}
        initialPlayers={serializedPlayers}
        initialClosed={tournament.closed ?? false}
      />
    </div>
  );
}
