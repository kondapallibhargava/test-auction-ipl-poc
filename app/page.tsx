'use client';

import { useState } from 'react';
import SignUpForm from '@/components/auth/SignUpForm';
import LoginForm from '@/components/auth/LoginForm';
import Card from '@/components/ui/Card';

export default function Home() {
  const [view, setView] = useState<'signup' | 'login'>('signup');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-black mb-2" style={{ color: '#f7941d' }}>
          🏏 IPL Auction
        </h1>
        <p className="text-gray-400 text-lg">Real-time multi-team cricket player auction</p>
      </div>

      {/* Auth Card */}
      <Card bordered className="w-full max-w-md">
        <div className="flex mb-6 rounded-lg overflow-hidden border border-white/10">
          <button
            onClick={() => setView('signup')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              view === 'signup'
                ? 'text-white font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
            style={view === 'signup' ? { backgroundColor: '#f7941d' } : {}}
          >
            Sign Up
          </button>
          <button
            onClick={() => setView('login')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              view === 'login'
                ? 'text-white font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
            style={view === 'login' ? { backgroundColor: '#f7941d' } : {}}
          >
            Log In
          </button>
        </div>

        {view === 'signup' ? (
          <SignUpForm onSwitch={() => setView('login')} />
        ) : (
          <LoginForm onSwitch={() => setView('signup')} />
        )}
      </Card>

      {/* Feature bullets */}
      <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg text-center">
        {[
          { icon: '⚡', label: 'Real-time bidding' },
          { icon: '🏟️', label: 'Multi-team rooms' },
          { icon: '📊', label: 'Live budget tracking' },
        ].map(f => (
          <div key={f.label}>
            <div className="text-2xl mb-1">{f.icon}</div>
            <p className="text-gray-400 text-xs">{f.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
