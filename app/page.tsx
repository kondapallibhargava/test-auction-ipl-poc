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

      {/* How to use */}
      <div className="mt-10 w-full max-w-2xl rounded-xl p-5 border border-[#f7941d]/20" style={{ backgroundColor: '#252525' }}>
        <h2 className="text-white font-semibold mb-4">How to use</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-[#f7941d] font-semibold mb-3">As Host</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-400 text-sm">
              <li>Create a tournament (set budget + max teams)</li>
              <li>Share the code (e.g. <span className="font-mono">IPL-4X9K</span>) with friends</li>
              <li>Start the auction once everyone has joined</li>
              <li>For each player: wait for bids → click Sold or Unsold</li>
              <li>After the auction: the admin imports match scorecards to update the leaderboard</li>
            </ol>
          </div>
          <div>
            <h3 className="text-[#f7941d] font-semibold mb-3">As Participant</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-400 text-sm">
              <li>Get the tournament code from the host</li>
              <li>Join with the code + pick a team name</li>
              <li>Bid on players within your budget during the auction</li>
              <li>Track your squad and fantasy points in the leaderboard</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
