'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';

export default function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="text-center space-y-3">
        <p className="text-red-400">Missing or invalid reset link.</p>
        <Link href="/forgot-password" className="text-[#f7941d] text-sm hover:underline">
          Request a new one
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Reset failed');
      router.push('/?reset=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-white font-semibold text-lg mb-1">Choose a new password</h2>
      </div>
      <div>
        <label className="block text-sm text-gray-300 mb-1">New password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-[#181818] border border-white/20 text-white focus:outline-none focus:border-[#f7941d]"
          placeholder="At least 4 characters"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-gray-300 mb-1">Confirm password</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-[#181818] border border-white/20 text-white focus:outline-none focus:border-[#f7941d]"
          placeholder="Same password again"
          required
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
        {loading ? 'Resetting…' : 'Reset password'}
      </Button>
    </form>
  );
}
