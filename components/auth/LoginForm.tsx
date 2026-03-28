'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

export default function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-300 mb-1">Username</label>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-[#060d1a] border border-white/20 text-white focus:outline-none focus:border-[#f7941d]"
          placeholder="Your username"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-gray-300 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-[#060d1a] border border-white/20 text-white focus:outline-none focus:border-[#f7941d]"
          placeholder="Your password"
          required
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
        {loading ? 'Logging in...' : 'Log In'}
      </Button>
      <p className="text-center text-sm text-gray-400">
        New here?{' '}
        <button type="button" onClick={onSwitch} className="text-[#f7941d] hover:underline">
          Sign up
        </button>
      </p>
    </form>
  );
}
