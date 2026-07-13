'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/landing/BrandLogo';

interface Brand {
  slug: string;
  name: string;
  activeCodes: number;
  successRate: number;
  totalClicks: number;
}

const FALLBACK_BRANDS: Brand[] = [
  { slug: 'nordvpn', name: 'NordVPN', activeCodes: 12, successRate: 88, totalClicks: 3402 },
  { slug: 'uber', name: 'Uber', activeCodes: 8, successRate: 86, totalClicks: 2104 },
  { slug: 'nike', name: 'Nike', activeCodes: 15, successRate: 84, totalClicks: 1897 },
  { slug: 'spotify', name: 'Spotify', activeCodes: 6, successRate: 82, totalClicks: 1563 },
  { slug: 'doordash', name: 'DoorDash', activeCodes: 9, successRate: 79, totalClicks: 1234 },
  { slug: 'hbo', name: 'HBO', activeCodes: 4, successRate: 91, totalClicks: 987 },
  { slug: 'skillshare', name: 'Skillshare', activeCodes: 5, successRate: 76, totalClicks: 876 },
  { slug: 'amazon', name: 'Amazon', activeCodes: 18, successRate: 73, totalClicks: 4321 },
  { slug: 'adidas', name: 'Adidas', activeCodes: 7, successRate: 80, totalClicks: 765 },
  { slug: 'hostinger', name: 'Hostinger', activeCodes: 3, successRate: 92, totalClicks: 654 },
  { slug: 'lyft', name: 'Lyft', activeCodes: 5, successRate: 78, totalClicks: 543 },
  { slug: 'grubhub', name: 'Grubhub', activeCodes: 4, successRate: 85, totalClicks: 432 },
];

interface Props {
  initial?: Brand[];
}

export function TrendingGrid({ initial }: Props) {
  const [brands, setBrands] = useState<Brand[]>(initial || FALLBACK_BRANDS);
  const [usingFallback, setUsingFallback] = useState(!initial || initial.length === 0);

  useEffect(() => {
    if (!initial || initial.length === 0) {
      fetch('/api/brands')
        .then((r) => r.json())
        .then((data) => {
          if (data.brands?.length > 0) {
            setBrands(data.brands);
            setUsingFallback(false);
          }
        })
        .catch(() => {});
    }
  }, [initial]);

  const display = usingFallback ? FALLBACK_BRANDS : brands;
  const top = display.slice(0, 12);

  return (
    <section>
      <h2 className="text-2xl font-bold text-center" style={{ color: 'var(--text-primary)' }}>
        Trending Promo Codes
      </h2>
      <p className="mt-2 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        {usingFallback ? 'Popular brands on CodeXhange' : 'Most active brands on CodeXhange right now'}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {top.map((brand) => (
          <Link
            key={brand.slug}
            href={`/brand/${brand.slug}`}
            className="glass-card flex flex-col items-center text-center p-4 hover:scale-[1.02] transition-transform"
            title={`${brand.name} promo codes — ${brand.activeCodes} active deals with ${Math.round(brand.successRate)}% success rate`}
          >
            <BrandLogo brand={brand.name} slug={brand.slug} size={48} />
            <h3 className="mt-2 text-sm font-semibold truncate w-full" style={{ color: 'var(--text-primary)' }}>
              {brand.name}
            </h3>
            <p className="mt-0.5 text-xs font-medium" style={{ color: '#f59e0b' }}>
              {brand.activeCodes} code{brand.activeCodes !== 1 ? 's' : ''}
            </p>
            <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {Math.round(brand.successRate)}% success
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
