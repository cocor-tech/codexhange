'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface HotCode {
  code: string;
  brand: string;
  brandSlug: string;
  discount: string;
  description: string;
  upvotes: number;
  totalVotes: number;
  successRate: number;
  link?: string;
}

const FALLBACK_CODES: HotCode[] = [
  { code: 'SAVE20', brand: 'NordVPN', brandSlug: 'nordvpn', discount: '20% off first year', description: 'Save on VPN + cybersecurity', upvotes: 42, totalVotes: 48, successRate: 88 },
  { code: 'TRIP10', brand: 'Uber', brandSlug: 'uber', discount: '10% off rides', description: 'Discount on your next trip', upvotes: 38, totalVotes: 44, successRate: 86 },
  { code: 'FREESHIP', brand: 'Nike', brandSlug: 'nike', discount: 'Free shipping', description: 'Free delivery on all orders', upvotes: 31, totalVotes: 37, successRate: 84 },
  { code: 'STREAM15', brand: 'Spotify', brandSlug: 'spotify', discount: '15% off premium', description: 'Music streaming discount', upvotes: 27, totalVotes: 33, successRate: 82 },
];

export function HotDealsStrip() {
  const [codes, setCodes] = useState<HotCode[]>(FALLBACK_CODES);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/codes/hot')
      .then((r) => r.json())
      .then((data) => {
        if (data.codes?.length > 0) setCodes(data.codes);
      })
      .catch(() => {});
  }, []);

  const handleCopy = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }, []);

  return (
    <section className="mx-auto max-w-5xl px-6 pb-12">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>🔥 Hot Deals</span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {codes === FALLBACK_CODES ? 'Popular codes to get you started' : 'Top community-rated codes'}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {codes.map((item) => (
          <div key={item.code} className="glass-card flex flex-col p-3.5">
            <div className="flex items-center justify-between mb-1">
              <Link
                href={`/brand/${item.brandSlug}`}
                className="text-xs font-semibold hover:underline truncate"
                style={{ color: '#f59e0b' }}
              >
                {item.brand}
              </Link>
              <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                {Math.round(item.successRate)}% success
              </span>
            </div>
            <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
              {item.description}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {item.discount}
            </p>
            <button
              onClick={() => handleCopy(item.code)}
              className={`mt-2 w-full rounded-lg border py-1.5 text-xs font-mono font-bold tracking-wide transition-all ${
                copied === item.code
                  ? 'border-green-500/40 bg-green-500/10 text-green-400'
                  : 'border-[var(--border)] hover:border-brand-500/50 hover:bg-brand-500/10 text-[var(--text-primary)]'
              }`}
              aria-label={`Copy promo code ${item.code}`}
            >
              {copied === item.code ? 'Copied!' : item.code}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
