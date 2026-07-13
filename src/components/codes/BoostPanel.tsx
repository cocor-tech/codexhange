'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { getDeviceFingerprint } from '@/lib/fingerprint';

interface BoostPanelProps {
  codeId: string;
  boosted: boolean;
  boostedUntil?: string;
  boostClicksUsed?: number;
  boostClicksLimit?: number;
  onBoosted?: () => void;
}

export function BoostPanel({ codeId, boosted, boostedUntil, boostClicksUsed = 0, boostClicksLimit = 0, onBoosted }: BoostPanelProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState<'micro' | 'mega' | null>(null);
  const [error, setError] = useState('');

  const isMegaActive = !!(boosted && boostedUntil && new Date(boostedUntil) > new Date());
  const isMicroActive = !!(boosted && !boostedUntil && boostClicksUsed < boostClicksLimit);

  const handleBoost = async (type: 'micro' | 'mega') => {
    if (!session) return;
    setLoading(type);
    setError('');

    try {
      const fp = getDeviceFingerprint();
      const res = await fetch('/api/fuel/boost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': fp,
        },
        body: JSON.stringify({ codeId, type }),
      });
      const data = await res.json();
      if (res.ok) {
        onBoosted?.();
      } else {
        setError(data.error || 'Boost failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      {isMegaActive && (
        <p className="text-[10px]" style={{ color: '#f59e0b' }}>
          Boosted until {new Date(boostedUntil || '').toLocaleDateString()}
        </p>
      )}
      {isMicroActive && (
        <p className="text-[10px]" style={{ color: '#f59e0b' }}>
          {boostClicksLimit - boostClicksUsed} clicks remaining
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => handleBoost('micro')}
          disabled={!!loading || !session || isMicroActive}
          className="rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-30 hover:border-brand-500/50 hover:bg-brand-500/10"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          title={session ? 'Boost for 15 clicks (50 Fuel)' : 'Sign in to boost'}
        >
          {loading === 'micro' ? '...' : '⚡ Micro Boost'}
          <span className="block text-[8px] opacity-60">50 Fuel · 15 clicks</span>
        </button>

        <button
          onClick={() => handleBoost('mega')}
          disabled={!!loading || !session || isMegaActive}
          className="rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-30 hover:border-brand-500/50 hover:bg-brand-500/10"
          style={{ borderColor: '#f59e0b40', color: '#f59e0b' }}
          title={session ? 'Boost for 7 days (500 Fuel)' : 'Sign in to boost'}
        >
          {loading === 'mega' ? '...' : '🔥 Mega Boost'}
          <span className="block text-[8px] opacity-60">500 Fuel · 7 days</span>
        </button>
      </div>

      {error && <p className="text-[10px]" style={{ color: '#ef4444' }}>{error}</p>}
    </div>
  );
}
