import { Team } from '@/lib/types';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface LobbyProps {
  teams: Record<string, Team>;
  myTeamId?: string;
  isHost: boolean;
}

export default function Lobby({ teams, myTeamId, isHost }: LobbyProps) {
  const teamList = Object.values(teams);

  return (
    <Card bordered>
      <h3 className="text-white font-semibold mb-4">Lobby — Teams Joined</h3>
      <div className="space-y-2">
        {teamList.map(team => (
          <div
            key={team.id}
            className={`flex items-center justify-between px-3 py-2 rounded-md ${
              team.id === myTeamId ? 'border border-[#f7941d]/30 bg-[#0c2d5e]/30' : 'bg-white/5'
            }`}
          >
            <span className={team.id === myTeamId ? 'text-[#f7941d]' : 'text-white'}>
              {team.teamName}
              {team.id === myTeamId && <span className="text-gray-400 text-xs ml-2">(you)</span>}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">${team.initialBudget}M</span>
              {isHost && team.userId === (Object.values(teams).find(t => t.id === team.id)?.userId) && (
                <Badge variant="orange">Host</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
      {isHost && teamList.length < 2 && (
        <p className="text-amber-400 text-sm mt-4 text-center">
          Waiting for at least 2 teams to start...
        </p>
      )}
    </Card>
  );
}
