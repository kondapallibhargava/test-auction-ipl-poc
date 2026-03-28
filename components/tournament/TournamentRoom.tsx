'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Team, AuctionState, TournamentEvent, TournamentPlayer } from '@/lib/types';
import { useTournamentStream } from '@/hooks/useTournamentStream';
import CurrentPlayerCard from './CurrentPlayerCard';
import BidPanel from './BidPanel';
import BidHistory from './BidHistory';
import TeamBudgetTable from './TeamBudgetTable';
import HostControls from './HostControls';
import AuctionStatusBanner from './AuctionStatusBanner';
import Lobby from './Lobby';
import ScoringPanel from './ScoringPanel';
import Card from '@/components/ui/Card';

interface TournamentRoomProps {
  code: string;
  tournamentName: string;
  isHost: boolean;
  userId: string;
  initialTeams: Record<string, Team>;
  initialAuctionState: AuctionState;
  initialPlayers: Record<string, TournamentPlayer>;
  initialClosed: boolean;
}

export default function TournamentRoom({
  code,
  tournamentName,
  isHost,
  userId,
  initialTeams,
  initialAuctionState,
  initialPlayers,
  initialClosed,
}: TournamentRoomProps) {
  const [teams, setTeams] = useState<Record<string, Team>>(initialTeams);
  const [auctionState, setAuctionState] = useState<AuctionState>(initialAuctionState);
  const [players, setPlayers] = useState<Record<string, TournamentPlayer>>(initialPlayers);
  const [isClosed, setIsClosed] = useState(initialClosed);
  const closedRef = useRef(initialClosed);
  closedRef.current = isClosed;

  const handleEvent = useCallback((event: TournamentEvent) => {
    if (event.payload.auctionState) {
      setAuctionState(event.payload.auctionState);
    }
    if (event.payload.teams) {
      setTeams(event.payload.teams as Record<string, Team>);
    }
  }, []);

  useTournamentStream({ code, onEvent: handleEvent });

  // Polling: primary sync mechanism for all users (2s interval).
  // Guarantees state updates even when SSE events are missed (e.g. Turbopack
  // dev mode, reconnects, tab backgrounding).
  const statusRef = useRef(auctionState.status);
  statusRef.current = auctionState.status;

  useEffect(() => {
    const poll = async () => {
      if (closedRef.current) return;
      try {
        const res = await fetch(`/api/tournaments/${code}`);
        if (!res.ok) return;
        const data = await res.json();
        setAuctionState(data.auctionState);
        setTeams(data.teams);
        setPlayers(data.players ?? {});
        setIsClosed(data.closed ?? false);
      } catch {
        // network hiccup — will retry next tick
      }
    };
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [code]);

  async function refreshState() {
    try {
      const res = await fetch(`/api/tournaments/${code}`);
      if (res.ok) {
        const data = await res.json();
        setAuctionState(data.auctionState);
        setTeams(data.teams);
        setPlayers(data.players ?? {});
        setIsClosed(data.closed ?? false);
      }
    } catch { /* ignore */ }
  }

  async function handleAuctionAction(action: string) {
    try {
      const res = await fetch(`/api/tournaments/${code}/auction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) await refreshState();
    } catch { /* ignore */ }
  }

  // Find my team
  const myTeam = Object.values(teams).find(t => t.userId === userId) ?? null;
  const myTeamId = myTeam?.id;

  const inLobby = auctionState.status === 'lobby';
  const isCompleted = auctionState.status === 'completed';

  // Derive unsold players from the full player list (not just the current queue)
  const soldPlayerIds = new Set(
    Object.values(teams).flatMap(t => t.players.map(p => p.id))
  );
  const unsoldPlayers = Object.values(players).filter(
    p => !soldPlayerIds.has(p.id)
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{tournamentName}</h1>
          <p className="text-[#f7941d] font-mono text-sm">{code}</p>
        </div>
        <AuctionStatusBanner status={auctionState.status} />
      </div>

      {inLobby ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Lobby teams={teams} myTeamId={myTeamId} isHost={isHost} />
            {/* Invite code card */}
            <Card bordered className="mt-4">
              <p className="text-gray-400 text-sm mb-2">Share this code to invite others:</p>
              <div
                className="flex items-center justify-between px-4 py-3 rounded-md"
                style={{ backgroundColor: '#0c2d5e' }}
              >
                <span className="text-[#f7941d] font-mono text-xl font-bold tracking-widest">{code}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(code)}
                  className="text-sm text-gray-300 hover:text-white transition"
                >
                  Copy
                </button>
              </div>
            </Card>
          </div>
          <div>
            {isHost && (
              <HostControls
                code={code}
                auctionState={auctionState}
                teamCount={Object.keys(teams).length}
                onAction={refreshState}
              />
            )}
            {!isHost && (
              <Card bordered className="text-center py-8 space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-gray-300 font-medium">Connected — live</p>
                </div>
                <p className="text-gray-500 text-sm">Waiting for the host to start the auction.</p>
                <p className="text-gray-600 text-xs">Your screen will update automatically.</p>
              </Card>
            )}
          </div>
        </div>
      ) : isCompleted ? (
        <div>
          <Card bordered className="mb-6 text-center py-8">
            <h2 className="text-2xl font-bold text-[#f7941d] mb-2">🏆 Auction Complete!</h2>
            <p className="text-gray-400">{isClosed ? 'Auction closed.' : 'Final results below'}</p>
          </Card>
          <TeamBudgetTable teams={teams} myTeamId={myTeamId} />

          {/* Unsold players panel */}
          {unsoldPlayers.length > 0 && (
            <Card bordered className="mt-6">
              <h3 className="text-white font-semibold mb-3">
                🏷 Unsold Players ({unsoldPlayers.length})
              </h3>
              <div className="space-y-1">
                {unsoldPlayers.map(p => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className="text-gray-300">{p.name}</span>
                    <span className="text-gray-500">${p.basePrice}K base</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Host action bar for re-run / close */}
          {isHost && !isClosed && (
            <div className="mt-4 flex gap-3 flex-wrap">
              <button
                disabled={unsoldPlayers.length === 0}
                onClick={() => handleAuctionAction('rerun')}
                className="px-4 py-2 rounded text-sm font-medium transition"
                style={{
                  backgroundColor: unsoldPlayers.length === 0 ? '#0a1e3d' : '#0c2d5e',
                  color: unsoldPlayers.length === 0 ? '#4b5563' : '#f7941d',
                  cursor: unsoldPlayers.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Re-run Auction ({unsoldPlayers.length} unsold)
              </button>
              <button
                onClick={() => handleAuctionAction('close')}
                className="px-4 py-2 rounded text-sm font-medium transition"
                style={{ backgroundColor: '#1e0500', color: '#ef4444', cursor: 'pointer' }}
              >
                Close Auction
              </button>
            </div>
          )}

          {/* Final squad view */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(teams).map(team => (
              <Card key={team.id} bordered>
                <h3 className={`font-semibold mb-3 ${team.id === myTeamId ? 'text-[#f7941d]' : 'text-white'}`}>
                  {team.teamName}
                </h3>
                <div className="space-y-1">
                  {team.players.map(p => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="text-gray-300">{p.name}</span>
                      <span className="text-[#f7941d]">${p.soldFor}K</span>
                    </div>
                  ))}
                  {team.players.length === 0 && (
                    <p className="text-gray-500 text-sm">No players acquired</p>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <ScoringPanel code={code} isHost={isHost} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: current player + bid */}
          <div className="lg:col-span-1 space-y-4">
            <CurrentPlayerCard player={auctionState.currentPlayer} />

            {auctionState.currentHighestBid && (
              <Card bordered>
                <p className="text-sm text-gray-400 mb-1">Current Highest Bid</p>
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold">{auctionState.currentHighestBid.teamName}</span>
                  <span className="text-[#f7941d] text-xl font-bold">${auctionState.currentHighestBid.amount}K</span>
                </div>
              </Card>
            )}

            {myTeam && (
              <BidPanel
                code={code}
                auctionState={auctionState}
                myTeam={myTeam}
                userId={userId}
                onBidPlaced={refreshState}
              />
            )}

            {isHost && (
              <HostControls
                code={code}
                auctionState={auctionState}
                teamCount={Object.keys(teams).length}
                onAction={refreshState}
              />
            )}
          </div>

          {/* Middle: bid history + log */}
          <div className="lg:col-span-1 space-y-4">
            <BidHistory bids={auctionState.bidHistory} userId={userId} />
            <Card bordered>
              <h3 className="text-white font-semibold mb-3">Auction Log</h3>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {[...auctionState.auctionLog].reverse().map((entry, i) => (
                  <p key={i} className="text-gray-400 text-xs py-0.5 border-b border-white/5">
                    {entry}
                  </p>
                ))}
              </div>
            </Card>
          </div>

          {/* Right: teams */}
          <div className="lg:col-span-1">
            <TeamBudgetTable teams={teams} myTeamId={myTeamId} />
          </div>
        </div>
      )}
    </div>
  );
}
