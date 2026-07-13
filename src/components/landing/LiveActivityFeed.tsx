'use client';

import { useState, useEffect } from 'react';

interface Activity {
  user: string;
  action: string;
  fuel: number;
  type: string;
  time: string;
}

const FALLBACK_FEED: Activity[] = [
  { user: 'Sarah', action: 'verified a NordVPN promo code', fuel: 10, type: 'earned', time: new Date(Date.now() - 120000).toISOString() },
  { user: 'Mike', action: 'submitted an Uber discount code', fuel: 5, type: 'earned', time: new Date(Date.now() - 300000).toISOString() },
  { user: 'Emma', action: 'voted on a Nike promo', fuel: 10, type: 'earned', time: new Date(Date.now() - 600000).toISOString() },
  { user: 'Alex', action: 'boosted a DoorDash code', fuel: 50, type: 'spent', time: new Date(Date.now() - 900000).toISOString() },
  { user: 'Jordan', action: 'verified a Spotify discount', fuel: 10, type: 'earned', time: new Date(Date.now() - 1800000).toISOString() },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function LiveActivityFeed() {
  const [feed, setFeed] = useState<Activity[]>(FALLBACK_FEED);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    fetch('/api/activity')
      .then((r) => r.json())
      .then((data) => {
        if (data.feed?.length > 0) {
          setFeed(data.feed);
          setUsingFallback(false);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section>
      <h2 className="text-lg font-bold text-center lg:text-left" style={{ color: 'var(--text-primary)' }}>
        Live Community Activity
      </h2>
      <p className="mt-1 text-xs text-center lg:text-left" style={{ color: 'var(--text-muted)' }}>
        {usingFallback ? 'Example activity feed' : 'Real-time actions from users'}
      </p>
      <div className="mt-4 space-y-2">
        {feed.slice(0, 5).map((item, i) => (
          <div key={i} className="glass-card flex items-center gap-3 py-2.5 px-3.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
              style={{ backgroundColor: '#d9770620', color: '#f59e0b' }}
            >
              {item.user.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.user}</span>{' '}
                {item.action}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {timeAgo(item.time)}
              </p>
            </div>
            <span className={`shrink-0 text-xs font-semibold ${item.type === 'earned' ? 'text-green-400' : 'text-red-400'}`}>
              {item.type === 'earned' ? '+' : '-'}{item.fuel} Fuel
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
