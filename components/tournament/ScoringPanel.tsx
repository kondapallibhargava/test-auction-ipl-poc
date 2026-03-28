'use client';

import { useState, useEffect, useCallback } from 'react';
import { TournamentMatchResult, TeamMatchScore, PlayerPoints } from '@/lib/types';
import Card from '@/components/ui/Card';

interface ScoringPanelProps {
  code: string;
  isHost: boolean;
}

export default function ScoringPanel({ code, isHost }: ScoringPanelProps) {
  const [matchResults, setMatchResults] = useState<TournamentMatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${code}/score`);
      if (res.ok) {
        const data = await res.json();
        setMatchResults(data.matchResults ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  async function handleImportSample() {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${code}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'sample' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Import failed');
      } else {
        await fetchResults();
      }
    } catch {
      setError('Network error');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-xl font-bold text-white">Fantasy Points Leaderboard</h2>

      {isHost && (
        <Card bordered className="space-y-3">
          <h3 className="text-white font-semibold text-sm">Import Scorecard</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleImportSample}
              disabled={importing}
              className="px-4 py-2 rounded text-sm font-medium transition"
              style={{
                backgroundColor: importing ? '#0a1e3d' : '#0c2d5e',
                color: importing ? '#6b7280' : '#f7941d',
                cursor: importing ? 'not-allowed' : 'pointer',
              }}
            >
              {importing ? 'Importing…' : 'Import Sample Scorecard'}
            </button>
            <div className="relative flex-1">
              <input
                type="text"
                disabled
                placeholder="ESPN Cricinfo URL — coming soon"
                title="ESPN Cricinfo import is not yet implemented"
                className="w-full px-3 py-2 rounded text-sm cursor-not-allowed"
                style={{
                  backgroundColor: '#080f1e',
                  color: '#4b5563',
                  border: '1px solid #1a3d6b',
                }}
              />
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600"
                title="Coming soon"
              >
                🔒
              </span>
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </Card>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading results…</p>
      ) : matchResults.length === 0 ? (
        <Card bordered>
          <p className="text-gray-500 text-sm text-center py-4">
            No match results yet.{isHost ? ' Import a scorecard above to get started.' : ''}
          </p>
        </Card>
      ) : (
        matchResults.map((result) => (
          <div key={result.importedAt} className="space-y-3">
            <div className="text-gray-400 text-sm">
              <span className="text-white font-medium">{result.match.title}</span>
              {result.match.venue && (
                <span className="ml-2 text-gray-500">· {result.match.venue}</span>
              )}
            </div>
            {result.teamScores.map((ts, rank) => (
              <Card key={ts.teamId} bordered>
                <button
                  className="w-full flex items-center justify-between"
                  onClick={() =>
                    setExpandedTeam(expandedTeam === ts.teamId ? null : ts.teamId)
                  }
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-lg font-bold w-7"
                      style={{ color: rank === 0 ? '#f7941d' : rank === 1 ? '#C0C0C0' : rank === 2 ? '#CD7F32' : '#6b7280' }}
                    >
                      #{rank + 1}
                    </span>
                    <span className="text-white font-semibold">{ts.teamName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#f7941d] font-bold text-lg">{ts.totalPoints}pts</span>
                    <span className="text-gray-500 text-sm">{expandedTeam === ts.teamId ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expandedTeam === ts.teamId && (
                  <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                    {ts.playerScores.length === 0 ? (
                      <p className="text-gray-500 text-sm">No players scored in this match.</p>
                    ) : (
                      ts.playerScores.map((ps) => (
                        <PlayerScoreRow key={ps.playerName} ps={ps} />
                      ))
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function PlayerScoreRow({ ps }: { ps: PlayerPoints }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <div className="text-sm">
      <button
        className="w-full flex items-center justify-between py-1 hover:opacity-80 transition"
        onClick={() => setShowBreakdown(!showBreakdown)}
      >
        <span className="text-gray-300">{ps.playerName}</span>
        <div className="flex gap-3 text-xs text-gray-500">
          {ps.batting > 0 && <span>Bat: {ps.batting}</span>}
          {ps.bowling > 0 && <span>Bowl: {ps.bowling}</span>}
          {ps.fielding > 0 && <span>Field: {ps.fielding}</span>}
          <span className="text-[#f7941d] font-semibold ml-1">{ps.total}pts</span>
        </div>
      </button>
      {showBreakdown && ps.breakdown.length > 0 && (
        <div className="pl-4 pb-1 space-y-0.5">
          {ps.breakdown.map((line, i) => (
            <p key={i} className="text-gray-600 text-xs">{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
