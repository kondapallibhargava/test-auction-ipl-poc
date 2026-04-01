import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listTournamentsForUser, getUserById, serializeTournament } from '@/lib/store';
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

  const myTournaments = (await listTournamentsForUser(session.userId)).map(serializeTournament);
  const activeTournament = user.activeTournamentCode
    ? myTournaments.find(t => t.code === user.activeTournamentCode)
    : null;

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

        {/* How to use — always visible */}
        <div className="mt-8">
          <Card bordered>
            <h2 className="text-white font-semibold mb-4">How to use</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-[#f7941d] font-semibold mb-3">As Host</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-400 text-sm">
                  <li>Create a tournament (set budget + max teams)</li>
                  <li>Share the code (e.g. <span className="font-mono">IPL-4X9K</span>) with friends</li>
                  <li>Start the auction once everyone has joined</li>
                  <li>For each player: wait for bids → click Sold or Unsold</li>
                  <li>After the auction: import match scorecards to update the leaderboard</li>
                </ol>
              </div>
              <div>
                <h3 className="text-[#f7941d] font-semibold mb-3">As Participant</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-400 text-sm">
                  <li>Get the tournament code from the host</li>
                  <li>Join with the code + pick a team name</li>
                  <li>Bid on players within your budget during the auction</li>
                  <li>Track your squad and fantasy points in the leaderboard</li>
                </ol>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
