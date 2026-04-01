'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import { TournamentMatchResult } from '@/lib/types';

interface SerializedTournament {
  code: string;
  name: string;
  status: string;
  matchResults?: TournamentMatchResult[];
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface UploadState {
  matchTitle: string;
  matchDate: string;
  venue: string;
  matchId: string;
  scorecardText: string;
}

interface TournamentResult {
  tournamentCode: string;
  tournamentName: string;
  matchResult?: TournamentMatchResult;
  error?: string;
}

export default function AdminDashboard({ tournaments }: { tournaments: SerializedTournament[] }) {
  const ongoing = tournaments.filter(t => t.status === 'completed');

  const [form, setForm] = useState<UploadState>({
    matchTitle: '',
    matchDate: '',
    venue: '',
    matchId: '',
    scorecardText: '',
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TournamentResult[] | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  function handleTitleChange(title: string) {
    setForm(f => ({ ...f, matchTitle: title, matchId: slugify(title) }));
  }

  async function handleSubmit() {
    if (!form.matchTitle || !form.matchDate || !form.matchId || !form.scorecardText) {
      setGlobalError('Match title, date, ID, and scorecard text are required.');
      return;
    }
    setLoading(true);
    setResults(null);
    setGlobalError(null);
    try {
      const res = await fetch('/api/admin/scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scorecardText: form.scorecardText,
          matchId: form.matchId,
          matchTitle: form.matchTitle,
          matchDate: form.matchDate,
          venue: form.venue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGlobalError(data.error ?? 'Upload failed');
      } else {
        setResults(data.results);
        setForm({ matchTitle: '', matchDate: '', venue: '', matchId: '', scorecardText: '' });
      }
    } catch {
      setGlobalError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Ongoing tournaments list */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Ongoing Tournaments</h2>
        {ongoing.length === 0 ? (
          <p className="text-gray-400 text-sm">No ongoing tournaments. Tournaments become active for scoring once their auction is completed.</p>
        ) : (
          <div className="space-y-2">
            {ongoing.map(t => (
              <Card key={t.code} bordered>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">{t.name}</p>
                    <p className="text-gray-400 text-sm font-mono">{t.code}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {(t.matchResults?.length ?? 0)} match{(t.matchResults?.length ?? 0) !== 1 ? 'es' : ''} uploaded
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Single upload section */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Upload Scorecard</h2>
        <p className="text-gray-400 text-sm mb-4">
          Applies to all {ongoing.length} ongoing tournament{ongoing.length !== 1 ? 's' : ''}.
        </p>
        <Card bordered>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Match Title *</label>
                <input
                  type="text"
                  placeholder="RCB vs SRH, IPL 2026, Match 1"
                  value={form.matchTitle}
                  onChange={e => handleTitleChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm text-white bg-[#060d1a] border border-white/10 focus:outline-none focus:border-[#f7941d]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Match Date *</label>
                <input
                  type="date"
                  value={form.matchDate}
                  onChange={e => setForm(f => ({ ...f, matchDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md text-sm text-white bg-[#060d1a] border border-white/10 focus:outline-none focus:border-[#f7941d]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Venue</label>
                <input
                  type="text"
                  placeholder="Chinnaswamy Stadium, Bengaluru"
                  value={form.venue}
                  onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md text-sm text-white bg-[#060d1a] border border-white/10 focus:outline-none focus:border-[#f7941d]/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Match ID *</label>
                <input
                  type="text"
                  placeholder="auto-generated from title"
                  value={form.matchId}
                  onChange={e => setForm(f => ({ ...f, matchId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md text-sm text-white font-mono bg-[#060d1a] border border-white/10 focus:outline-none focus:border-[#f7941d]/50"
                />
                <p className="text-xs text-gray-500 mt-0.5">Used for deduplication — edit if re-uploading a correction</p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Scorecard Text * — copy all text from the ESPN Cricinfo full scorecard page (Ctrl+A, Ctrl+C) and paste here
              </label>
              <textarea
                rows={12}
                placeholder={"Sunrisers Hyderabad  (20 ovs maximum)\nBatting\tR\tB\t4s\t6s\tSR\nTravis Head \n11\t9\t2\t0\t122.22\nc Salt b Duffy\n..."}
                value={form.scorecardText}
                onChange={e => setForm(f => ({ ...f, scorecardText: e.target.value }))}
                className="w-full px-3 py-2 rounded-md text-xs text-white font-mono bg-[#060d1a] border border-white/10 focus:outline-none focus:border-[#f7941d]/50 resize-y"
              />
            </div>

            {globalError && (
              <p className="text-red-400 text-sm">{globalError}</p>
            )}

            {results && (
              <div className="space-y-1">
                {results.map(r => (
                  r.error ? (
                    <p key={r.tournamentCode} className="text-red-400 text-sm">
                      {r.tournamentName}: {r.error}
                    </p>
                  ) : (
                    <p key={r.tournamentCode} className="text-green-400 text-sm">
                      {r.tournamentName}: imported {r.matchResult?.match.performances.length} performances
                      {r.matchResult && r.matchResult.teamScores.length > 0 && (
                        <> — {r.matchResult.teamScores.slice(0, 3).map(t => `${t.teamName}: ${t.totalPoints}pts`).join(' · ')}</>
                      )}
                    </p>
                  )
                ))}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || ongoing.length === 0}
              className="px-4 py-2 rounded-md text-sm font-medium text-[#060d1a] disabled:opacity-50"
              style={{ backgroundColor: '#f7941d' }}
            >
              {loading ? 'Importing…' : `Import to ${ongoing.length} Tournament${ongoing.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
