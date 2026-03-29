import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listTournaments, getUserById, serializeTournament } from '@/lib/store';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import TournamentCard from '@/components/dashboard/TournamentCard';
import CreateTournamentForm from '@/components/dashboard/CreateTournamentForm';
import JoinTournamentForm from '@/components/dashboard/JoinTournamentForm';
import { Team } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = getSession(cookieStore.get('ipl-session')?.value);
  if (!session) redirect('/');

  const user = await getUserById(session.userId);
  if (!user) redirect('/');

  const allTournaments = (await listTournaments()).map(serializeTournament);
  const activeTournament = user.activeTournamentCode
    ? allTournaments.find(t => t.code === user.activeTournamentCode)
    : null;

  const openTournaments = allTournaments.filter(
    t => t.status === 'lobby' && t.code !== user.activeTournamentCode
  );
  const myTournaments = allTournaments.filter(t =>
    Object.values(t.teams as Record<string, Team>).some(team => team.userId === session.userId)
  );

  return (
    <div className="min-h-screen">
      <Header username={session.username} />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

        {/* Active tournament banner */}
        {activeTournament && (
          <div
            className="rounded-xl p-4 mb-6 border border-[#f7941d]/30 flex items-center justify-between"
            style={{ backgroundColor: '#0d1f38' }}
          >
            <div>
              <p className="text-[#f7941d] text-sm font-medium mb-0.5">Active Tournament</p>
              <p className="text-white font-semibold">{activeTournament.name}</p>
              <p className="text-gray-400 text-sm font-mono">{activeTournament.code}</p>
            </div>
            <a
              href={`/tournament/${activeTournament.code}`}
              className="px-4 py-2 rounded-md text-[#060d1a] font-bold text-sm"
              style={{ backgroundColor: '#f7941d' }}
            >
              Enter Room
            </a>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {!activeTournament && (
            <Card bordered>
              <h2 className="text-white font-semibold mb-4">Create Tournament</h2>
              <CreateTournamentForm />
            </Card>
          )}
          {!activeTournament && (
            <Card bordered>
              <h2 className="text-white font-semibold mb-4">Join Tournament</h2>
              <JoinTournamentForm />
            </Card>
          )}
        </div>

        {myTournaments.length > 0 && (
          <div className="mt-8">
            <h2 className="text-white font-semibold mb-4">My Tournaments</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myTournaments.map(t => (
                <TournamentCard
                  key={t.code}
                  tournament={{ ...t, teams: t.teams as Record<string, unknown> }}
                  currentUserId={session.userId}
                />
              ))}
            </div>
          </div>
        )}

        {!activeTournament && openTournaments.length > 0 && (
          <div className="mt-8">
            <h2 className="text-white font-semibold mb-4">Open Tournaments</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {openTournaments.map(t => (
                <TournamentCard
                  key={t.code}
                  tournament={{ ...t, teams: t.teams as Record<string, unknown> }}
                  currentUserId={session.userId}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
