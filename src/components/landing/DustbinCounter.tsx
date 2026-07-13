'use client';

import { useState, useEffect } from 'react';

interface Stats {
  activeCodes: number;
  archivedToday: number;
  totalBrands: number;
}

export function DustbinCounter() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const display = stats || { activeCodes: 1420, archivedToday: 86, totalBrands: 24 };

  if (!loaded) {
    return (
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="glass-card grid grid-cols-2 gap-4 sm:grid-cols-3 text-center py-5">
          {[null, null, null].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="h-7 w-16 animate-pulse rounded" style={{ backgroundColor: 'var(--hover-overlay)' }} />
              <div className="h-3 w-20 animate-pulse rounded" style={{ backgroundColor: 'var(--hover-overlay)' }} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-6 pb-12">
      <div className="glass-card grid grid-cols-2 gap-4 sm:grid-cols-3 text-center py-5">
        <div>
          <p className="text-2xl font-extrabold" style={{ color: '#f59e0b' }}>
            {display.activeCodes.toLocaleString()}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Active Codes
          </p>
        </div>
        <div>
          <p className="text-2xl font-extrabold" style={{ color: '#22c55e' }}>
            {display.archivedToday.toLocaleString()}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Expired Codes Cleaned Today
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            {display.totalBrands.toLocaleString()}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Brands Tracked
          </p>
        </div>
      </div>
    </section>
  );
}
