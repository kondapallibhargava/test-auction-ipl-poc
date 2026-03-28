'use client';

import { useState } from 'react';
import { AuctionState } from '@/lib/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface HostControlsProps {
  code: string;
  auctionState: AuctionState;
  teamCount: number;
  onAction: () => void;
}

export default function HostControls({ code, auctionState, teamCount, onAction }: HostControlsProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function doAction(action: string) {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${code}/auction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  const { status, currentHighestBid } = auctionState;

  return (
    <Card bordered>
      <h3 className="text-[#f7941d] font-semibold mb-3 flex items-center gap-2">
        <span>⚙</span> Host Controls
      </h3>

      <div className="space-y-2">
        {status === 'lobby' && (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => doAction('start')}
            disabled={loading || teamCount < 2}
          >
            {teamCount < 2 ? `Need ${2 - teamCount} more team(s)` : 'Start Auction'}
          </Button>
        )}

        {status === 'player_up' && (
          <>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => doAction('sold')}
              disabled={loading || !currentHighestBid}
            >
              {currentHighestBid ? `Mark SOLD — $${currentHighestBid.amount}K to ${currentHighestBid.teamName}` : 'Mark SOLD (no bids)'}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => doAction('unsold')}
              disabled={loading}
            >
              Mark UNSOLD
            </Button>
          </>
        )}

        {(status === 'sold' || status === 'unsold') && (
          <div className="text-center text-gray-400 text-sm py-2">
            Advancing to next player...
          </div>
        )}

        {status !== 'lobby' && status !== 'completed' && (
          <Button
            variant="danger"
            size="sm"
            className="w-full mt-2"
            onClick={() => doAction('reset')}
            disabled={loading}
          >
            Reset Auction
          </Button>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </Card>
  );
}
