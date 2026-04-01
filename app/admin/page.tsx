import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listTournaments, serializeTournament } from '@/lib/store';
import Header from '@/components/layout/Header';
import AdminDashboard from '@/components/admin/AdminDashboard';

export const dynamic = 'force-dynamic';

function isAdmin(username: string): boolean {
  const adminUsername = process.env.ADMIN_USERNAME;
  return !!adminUsername && username === adminUsername;
}

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = getSession(cookieStore.get('ipl-session')?.value);

  if (!session) redirect('/');
  if (!isAdmin(session.username)) redirect('/dashboard');

  const tournaments = (await listTournaments()).map(serializeTournament);

  return (
    <div className="min-h-screen">
      <Header username={session.username} />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Admin</h1>
        </div>
        <AdminDashboard tournaments={tournaments} />
      </div>
    </div>
  );
}
