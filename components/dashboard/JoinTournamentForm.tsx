'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

export default function JoinTournamentForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${code.toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/tournament/${code.toUpperCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join tournament');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm text-gray-300 mb-1">Tournament Code</label>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          className="w-full px-3 py-2 rounded-md bg-[#181818] border border-white/20 text-white focus:outline-none focus:border-[#f7941d] text-sm font-mono tracking-widest"
          placeholder="IPL-XXXX"
          maxLength={8}
          required
        />
      </div>
      <div>
        <label className="block text-sm text-gray-300 mb-1">Your Team Name</label>
        <input
          type="text"
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-[#181818] border border-white/20 text-white focus:outline-none focus:border-[#f7941d] text-sm"
          placeholder="e.g. Mumbai Indians"
          required
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <Button type="submit" variant="secondary" className="w-full" disabled={loading}>
        {loading ? 'Joining...' : 'Join Tournament'}
      </Button>
    </form>
  );
}
