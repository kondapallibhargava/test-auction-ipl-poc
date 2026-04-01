import { Team } from '@/lib/types';
import Card from '@/components/ui/Card';

interface TeamBudgetTableProps {
  teams: Record<string, Team>;
  myTeamId?: string;
}

export default function TeamBudgetTable({ teams, myTeamId }: TeamBudgetTableProps) {
  const sorted = Object.values(teams).sort((a, b) => b.remainingBudget - a.remainingBudget);

  return (
    <Card bordered>
      <h3 className="text-white font-semibold mb-3">Teams</h3>
      <div className="space-y-2">
        {sorted.map(team => {
          const spent = team.initialBudget - team.remainingBudget;
          const pct = (team.remainingBudget / team.initialBudget) * 100;
          return (
            <div
              key={team.id}
              className={`p-3 rounded-md ${team.id === myTeamId ? 'border border-[#f7941d]/40' : 'border border-white/10'}`}
              style={{ backgroundColor: '#181818' }}
            >
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className={`font-medium text-sm ${team.id === myTeamId ? 'text-[#f7941d]' : 'text-white'}`}>
                    {team.teamName}
                  </span>
                  {team.id === myTeamId && (
                    <span className="ml-2 text-xs text-gray-400">(you)</span>
                  )}
                </div>
                <div className="text-right text-sm">
                  <span className="text-white font-semibold">${team.remainingBudget.toFixed(1)}M</span>
                  <span className="text-gray-500 text-xs ml-1">left</span>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: pct > 40 ? '#00C851' : pct > 20 ? '#f7941d' : '#ff4444' }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>{team.players.length} players</span>
                <span>spent: ${spent.toFixed(1)}M</span>
              </div>
              {team.players.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                  {team.players.map(p => (
                    <div key={p.id} className="flex justify-between text-xs">
                      <span className="text-gray-300 truncate mr-2">{p.name}</span>
                      <span className="text-[#f7941d] shrink-0">${p.soldFor}K</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
