'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

export default function CreateTournamentForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [teamBudget, setTeamBudget] = useState('100');
  const [maxTeams, setMaxTeams] = useState('8');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, teamBudget: Number(teamBudget), maxTeams: Number(maxTeams) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/tournament/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm text-gray-300 mb-1">Tournament Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-[#181818] border border-white/20 text-white focus:outline-none focus:border-[#f7941d] text-sm"
          placeholder="e.g. IPL 2025"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-300 mb-1">Budget per team ($ M)</label>
          <input
            type="number"
            value={teamBudget}
            onChange={e => setTeamBudget(e.target.value)}
            min="50" max="1000"
            className="w-full px-3 py-2 rounded-md bg-[#181818] border border-white/20 text-white focus:outline-none focus:border-[#f7941d] text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Max Teams</label>
          <input
            type="number"
            value={maxTeams}
            onChange={e => setMaxTeams(e.target.value)}
            min="2" max="20"
            className="w-full px-3 py-2 rounded-md bg-[#181818] border border-white/20 text-white focus:outline-none focus:border-[#f7941d] text-sm"
            required
          />
        </div>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <Button type="submit" variant="primary" className="w-full" disabled={loading}>
        {loading ? 'Creating...' : 'Create Tournament'}
      </Button>
    </form>
  );
}
