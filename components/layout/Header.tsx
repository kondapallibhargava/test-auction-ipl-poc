'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface HeaderProps {
  username?: string;
}

export default function Header({ username }: HeaderProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <header
      style={{
        background: 'linear-gradient(135deg, #0c1f3d 0%, #0c2d5e 100%)',
        borderBottom: '3px solid #f7941d',
      }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span style={{ color: '#f7941d' }} className="text-2xl font-black tracking-tight">
            🏏 IPL Auction
          </span>
          <span
            style={{
              color: '#f7941d',
              opacity: 0.5,
              background: 'rgba(247,148,29,0.12)',
              border: '1px solid rgba(247,148,29,0.3)',
            }}
            className="text-xs hidden sm:block px-1.5 py-0.5 rounded font-semibold tracking-wider"
          >
            POC
          </span>
        </div>
        {username && (
          <div className="flex items-center gap-4">
            <span className="text-gray-300 text-sm">
              <span style={{ color: '#f7941d' }}>@</span>{username}
            </span>
            <button
              onClick={handleLogout}
              disabled={loading}
              style={{ backgroundColor: '#f7941d', color: '#060d1a' }}
              className="px-3 py-1 rounded text-sm font-bold hover:opacity-90 disabled:opacity-50 transition"
            >
              {loading ? '...' : 'Logout'}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
