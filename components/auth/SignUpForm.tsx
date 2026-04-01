'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

export default function SignUpForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email: email || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
          className="w-full px-3 py-2 rounded-md bg-[#181818] border border-white/20 text-white focus:outline-none focus:border-[#f7941d]"
          placeholder="3–20 characters"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-gray-300 mb-1">Email <span className="text-gray-500">(for password recovery)</span></label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-[#181818] border border-white/20 text-white focus:outline-none focus:border-[#f7941d]"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-300 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-[#181818] border border-white/20 text-white focus:outline-none focus:border-[#f7941d]"
          placeholder="At least 4 characters"
          required
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
        {loading ? 'Creating account...' : 'Sign Up'}
      </Button>
      <p className="text-center text-sm text-gray-400">
        Already have an account?{' '}
        <button type="button" onClick={onSwitch} className="text-[#f7941d] hover:underline">
          Log in
        </button>
      </p>
    </form>
  );
}
