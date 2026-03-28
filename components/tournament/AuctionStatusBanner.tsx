import { AuctionStatus } from '@/lib/types';
import Badge from '@/components/ui/Badge';

const STATUS_CONFIG: Record<AuctionStatus, { label: string; variant: 'gold' | 'green' | 'red' | 'orange' | 'gray' | 'blue'; bg: string }> = {
  lobby:     { label: 'Waiting in Lobby',  variant: 'gold',   bg: '#0a1e3d' },
  player_up: { label: 'BIDDING OPEN',      variant: 'green',  bg: '#0a2018' },
  sold:      { label: 'SOLD!',             variant: 'orange', bg: '#2a1400' },
  unsold:    { label: 'UNSOLD',            variant: 'red',    bg: '#2a0a0a' },
  completed: { label: 'AUCTION COMPLETE',  variant: 'gray',   bg: '#0f1a2e' },
};

export default function AuctionStatusBanner({ status }: { status: AuctionStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <div
      className="rounded-lg px-4 py-2 flex items-center justify-center gap-2"
      style={{ backgroundColor: config.bg }}
    >
      <Badge variant={config.variant}>{config.label}</Badge>
    </div>
  );
}
