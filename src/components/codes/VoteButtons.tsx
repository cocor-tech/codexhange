'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { getDeviceFingerprint } from '@/lib/fingerprint';

interface VoteButtonsProps {
  codeId: string;
  upvotes: number;
  downvotes: number;
  onVote?: (newUp: number, newDown: number) => void;
}

export function VoteButtons({ codeId, upvotes, downvotes, onVote }: VoteButtonsProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const total = upvotes + downvotes;
  const pct = total > 0 ? Math.round((upvotes / total) * 100) : 0;

  const handleVote = async (vote: 'up' | 'down') => {
    if (!session) return;
    setLoading(true);
    setError('');

    try {
      const fp = getDeviceFingerprint();
      const res = await fetch(`/api/codes/${codeId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': fp,
        },
        body: JSON.stringify({ vote }),
      });
      const data = await res.json();
      if (res.ok) {
        onVote?.(data.code.upvotes, data.code.downvotes);
      } else {
        setError(data.error || 'Vote failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote('up')}
        disabled={loading || !session}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-green-500/10 disabled:opacity-40"
        style={{ color: upvotes > downvotes ? '#22c55e' : 'var(--text-muted)' }}
        title={session ? 'Upvote (+10 Fuel)' : 'Sign in to vote'}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
        {upvotes}
      </button>

      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{
        backgroundColor: pct >= 60 ? '#22c55e15' : pct >= 30 ? '#f59e0b15' : '#ef444415',
        color: pct >= 60 ? '#22c55e' : pct >= 30 ? '#f59e0b' : '#ef4444',
      }}>
        {pct}%
      </span>

      <button
        onClick={() => handleVote('down')}
        disabled={loading || !session}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-red-500/10 disabled:opacity-40"
        style={{ color: downvotes > upvotes ? '#ef4444' : 'var(--text-muted)' }}
        title={session ? 'Downvote' : 'Sign in to vote'}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        {downvotes}
      </button>

      {error && <span className="text-[10px]" style={{ color: '#ef4444' }}>{error}</span>}
    </div>
  );
}
