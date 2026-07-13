'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const REGIONS = [
  { code: 'US', label: 'United States', flag: '🇺🇸' },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  { code: 'NG', label: 'Nigeria', flag: '🇳🇬' },
  { code: 'CA', label: 'Canada', flag: '🇨🇦' },
  { code: 'AU', label: 'Australia', flag: '🇦🇺' },
  { code: 'DE', label: 'Germany', flag: '🇩🇪' },
  { code: 'FR', label: 'France', flag: '🇫🇷' },
  { code: 'IN', label: 'India', flag: '🇮🇳' },
  { code: 'global', label: 'Global', flag: '🌍' },
];

export function RegionSelector() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<{ code: string; flag: string }>({ code: 'global', flag: '🌍' });
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const detected = tz.split('/').pop()?.slice(0, 2).toUpperCase() || '';
      const match = REGIONS.find((r) => r.code === detected);
      if (match) setCurrent({ code: match.code, flag: match.flag });
    } catch {}
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (code: string) => {
    setOpen(false);
    if (code === 'global') {
      setCurrent({ code: 'global', flag: '🌍' });
      return;
    }
    setCurrent({ code, flag: REGIONS.find((r) => r.code === code)?.flag || '🌍' });
    if (pathname.startsWith('/brand/')) {
      router.push(`${pathname}?country=${code.toLowerCase()}`);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition-colors hover:bg-[--hover-overlay]"
        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        aria-label="Select region"
      >
        <span className="text-sm">{current.flag}</span>
        <span className="hidden sm:inline">{current.code === 'global' ? 'Global' : current.code}</span>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-44 overflow-hidden rounded-xl border shadow-xl"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
        >
          {REGIONS.map((region) => (
            <button
              key={region.code}
              onClick={() => handleSelect(region.code)}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs transition-colors hover:bg-[--hover-overlay] ${
                current.code === region.code ? 'bg-brand-500/10' : ''
              }`}
            >
              <span className="text-sm">{region.flag}</span>
              <span style={{ color: 'var(--text-primary)' }}>{region.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
