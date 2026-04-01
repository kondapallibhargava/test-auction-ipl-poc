import { Bid } from '@/lib/types';
import Card from '@/components/ui/Card';

export default function BidHistory({ bids, userId }: { bids: Bid[]; userId: string }) {
  const reversed = [...bids].reverse();

  return (
    <Card bordered>
      <h3 className="text-white font-semibold mb-3">Bid History</h3>
      {reversed.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No bids yet</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {reversed.map((bid, i) => (
            <div
              key={bid.id}
              className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                bid.userId === userId ? 'bg-[#383838]/50' : 'bg-white/5'
              } ${i === 0 ? 'border border-[#f7941d]/30' : ''}`}
            >
              <span className={bid.userId === userId ? 'text-[#f7941d]' : 'text-gray-300'}>
                {bid.teamName}
                {i === 0 && <span className="ml-1 text-xs text-green-400">↑ Highest</span>}
              </span>
              <span className="text-white font-semibold">${bid.amount}K</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
