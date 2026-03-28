import { TournamentPlayer } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';

const ROLE_COLORS: Record<string, 'gold' | 'green' | 'blue' | 'orange'> = {
  'Batsman': 'gold',
  'Bowler': 'green',
  'All-Rounder': 'orange',
  'Wicket-Keeper': 'blue',
};

export default function CurrentPlayerCard({ player }: { player: TournamentPlayer | null }) {
  if (!player) {
    return (
      <Card bordered className="text-center py-12">
        <p className="text-gray-500 text-lg">No player up for auction</p>
      </Card>
    );
  }

  return (
    <Card bordered>
      <div className="text-center">
        <div
          className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl"
          style={{ backgroundColor: '#0c2d5e', border: '3px solid #f7941d' }}
        >
          🏏
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{player.name}</h2>
        <div className="flex items-center justify-center gap-2 mb-3">
          <Badge variant={ROLE_COLORS[player.role] ?? 'gray'}>{player.role}</Badge>
          <Badge variant={player.nationality === 'Overseas' ? 'orange' : 'blue'}>
            {player.nationality}
          </Badge>
        </div>
        <div className="text-[#f7941d] text-lg font-semibold">
          Base Price: ${player.basePrice}K
        </div>
      </div>
    </Card>
  );
}
