'use client';

import { useState } from 'react';

const DOMAIN_MAP: Record<string, string> = {
  nordvpn: 'nordvpn.com',
  uber: 'uber.com',
  nike: 'nike.com',
  spotify: 'spotify.com',
  doordash: 'doordash.com',
  hbo: 'hbomax.com',
  skillshare: 'skillshare.com',
  amazon: 'amazon.com',
  adidas: 'adidas.com',
  hostinger: 'hostinger.com',
  lyft: 'lyft.com',
  grubhub: 'grubhub.com',
};

interface Props {
  brand: string;
  slug: string;
  size?: number;
}

export function BrandLogo({ brand, slug, size = 48 }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const domain = DOMAIN_MAP[slug];
  const src = domain ? `https://logo.clearbit.com/${domain}?size=${size}` : null;

  return (
    <span
      className="flex items-center justify-center rounded-xl overflow-hidden"
      style={{ width: size, height: size, backgroundColor: '#d9770620' }}
    >
      {!loaded && !error && (
        <span className="text-lg font-bold" style={{ color: '#f59e0b' }}>
          {brand.charAt(0)}
        </span>
      )}
      {src && !error && (
        <img
          src={src}
          alt={`${brand} logo`}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={loaded ? 'block' : 'hidden'}
          style={{ objectFit: 'contain' }}
        />
      )}
      {!src && (
        <span className="text-lg font-bold" style={{ color: '#f59e0b' }}>
          {brand.charAt(0)}
        </span>
      )}
    </span>
  );
}
