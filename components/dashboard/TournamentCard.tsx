import Link from 'next/link';
import Badge from '@/components/ui/Badge';

interface TournamentCardProps {
  tournament: {
    code: string;
    name: string;
    status: string;
    teamBudget: number;
    teams: Record<string, unknown>;
    maxTeams: number;
    createdBy: string;
  };
  currentUserId: string;
}

export default function TournamentCard({ tournament, currentUserId }: TournamentCardProps) {
  const teamCount = Object.keys(tournament.teams).length;
  const isHost = tournament.createdBy === currentUserId;
  const statusVariant = tournament.status === 'active' ? 'green' : tournament.status === 'completed' ? 'gray' : 'gold';

  return (
    <Link href={`/tournament/${tournament.code}`}>
      <div
        className="rounded-xl p-4 border border-white/10 hover:border-[#f7941d]/40 transition-all cursor-pointer"
        style={{ backgroundColor: '#252525' }}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-white font-semibold">{tournament.name}</h3>
            <p className="text-[#f7941d] font-mono text-sm">{tournament.code}</p>
          </div>
          <div className="flex gap-1 flex-col items-end">
            <Badge variant={statusVariant}>{tournament.status}</Badge>
            {isHost && <Badge variant="orange">Host</Badge>}
          </div>
        </div>
        <div className="flex gap-4 text-sm text-gray-400 mt-3">
          <span>Teams: {teamCount}/{tournament.maxTeams}</span>
          <span>Budget: ${tournament.teamBudget}M</span>
        </div>
      </div>
    </Link>
  );
}
