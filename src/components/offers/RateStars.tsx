'use client';

import { useState } from 'react';

const STAR_FILL = 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';
const STAR_EMPTY = 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';

export function OfferRateStars({ offerId, avgRating = 0, ratingCount = 0 }: {
  offerId: string; avgRating?: number; ratingCount?: number;
}) {
  const [rating, setRating] = useState(avgRating);
  const [count, setCount] = useState(ratingCount);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const rate = async (n: number) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/offers/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, rating: n }),
      });
      const data = await res.json();
      if (res.ok) {
        setRating(data.avgRating);
        setCount(data.ratingCount);
        setMsg('Thanks!');
        setTimeout(() => setMsg(''), 2000);
      } else if (res.status === 404) {
        setMsg('Offer not found');
      }
    } catch {
      setMsg('Network error');
    }
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-1 text-xs" title="Rate this code">
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Rate</span>
      <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => rate(n)}
            onMouseEnter={() => setHover(n)}
            disabled={busy}
            className="transition-transform hover:scale-110 disabled:opacity-60"
            aria-label={`Rate ${n} stars`}
          >
            <svg className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill={(hover || rating) >= n ? '#f59e0b' : 'none'}
              stroke={(hover || rating) >= n ? '#f59e0b' : 'currentColor'}
              strokeWidth={1.5}>
              <path d={STAR_FILL} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
      {count > 0 && (
        <span style={{ color: 'var(--text-muted)' }}>{rating.toFixed(1)} ({count})</span>
      )}
      {msg && <span className="text-green-500">{msg}</span>}
    </div>
  );
}
