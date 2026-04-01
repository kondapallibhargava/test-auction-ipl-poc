'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Request failed');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-black mb-2" style={{ color: '#f7941d' }}>🏏 IPL Auction</h1>
      </div>
      <Card bordered className="w-full max-w-md">
        {submitted ? (
          <div className="text-center space-y-4">
            <p className="text-white font-semibold">Check your email</p>
            <p className="text-gray-400 text-sm">
              If an account with that address exists, we&apos;ve sent a reset link. Check your inbox (and spam folder).
            </p>
            <Link href="/" className="text-[#f7941d] text-sm hover:underline">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="text-white font-semibold text-lg mb-1">Reset password</h2>
              <p className="text-gray-400 text-sm">Enter the email linked to your account.</p>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-[#181818] border border-white/20 text-white focus:outline-none focus:border-[#f7941d]"
                placeholder="you@example.com"
                required
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
            <p className="text-center text-sm text-gray-400">
              <Link href="/" className="text-[#f7941d] hover:underline">Back to login</Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
