'use client';

import { useState } from 'react';
import { AuctionState, Team } from '@/lib/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface BidPanelProps {
  code: string;
  auctionState: AuctionState;
  myTeam: Team | null;
  userId: string;
  onBidPlaced: () => void;
}

export default function BidPanel({ code, auctionState, myTeam, userId, onBidPlaced }: BidPanelProps) {
  const [customAmount, setCustomAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { status, currentPlayer, currentHighestBid } = auctionState;

  if (status !== 'player_up' || !currentPlayer || !myTeam) return null;

  const minBid = currentHighestBid
    ? currentHighestBid.amount + 25
    : currentPlayer.basePrice;

  const isHighestBidder = currentHighestBid?.userId === userId;
  const budgetInThousands = myTeam.remainingBudget * 100;

  const quickBids = [minBid, minBid + 25, minBid + 50, minBid + 100].filter(b => b <= budgetInThousands);

  async function placeBid(amount: number) {
    if (isHighestBidder) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${code}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCustomAmount('');
      onBidPlaced();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bid failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card bordered>
      <h3 className="text-white font-semibold mb-3">Place Bid</h3>

      {isHighestBidder && (
        <div className="text-center py-3 rounded-md mb-3" style={{ backgroundColor: '#0a2018' }}>
          <p className="text-green-400 font-semibold">You have the highest bid!</p>
          <p className="text-green-300 text-sm">${currentHighestBid?.amount}K</p>
        </div>
      )}

      {!isHighestBidder && (
        <>
          <div className="mb-3">
            <p className="text-gray-400 text-sm mb-1">
              Min bid: <span className="text-[#f7941d] font-semibold">${minBid}K</span>
            </p>
            <p className="text-gray-400 text-sm">
              Your budget: <span className="text-white font-semibold">${myTeam.remainingBudget.toFixed(2)}M</span>
            </p>
          </div>

          {quickBids.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {quickBids.map(amount => (
                <Button
                  key={amount}
                  variant="secondary"
                  size="sm"
                  onClick={() => placeBid(amount)}
                  disabled={loading}
                >
                  ${amount}K
                </Button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="number"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              placeholder={`Min $${minBid}K`}
              min={minBid}
              max={budgetInThousands}
              className="flex-1 px-3 py-2 rounded-md bg-[#181818] border border-white/20 text-white text-sm focus:outline-none focus:border-[#f7941d]"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => placeBid(Number(customAmount))}
              disabled={loading || !customAmount}
            >
              Bid
            </Button>
          </div>
        </>
      )}

      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </Card>
  );
}
