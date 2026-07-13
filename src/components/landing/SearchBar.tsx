'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface BrandItem {
  slug: string;
  name: string;
  activeCodes?: number;
  category?: string;
}

interface SuggestionGroup {
  type: 'brand' | 'category';
  label: string;
  items: BrandItem[];
}

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geoCountry, setGeoCountry] = useState('');
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const country = tz.split('/').pop()?.slice(0, 2).toUpperCase() || '';
      setGeoCountry(country);
    } catch {}
  }, []);

  const search = useCallback((q: string) => {
    if (q.length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    fetch(`/api/brands/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => {
        const groups: SuggestionGroup[] = [];
        if (data.suggestions?.length > 0) {
          data.suggestions.forEach((g: any) => groups.push(g));
        } else if (data.brands?.length > 0) {
          groups.push({ type: 'brand', label: 'Brand Suggestions', items: data.brands });
        }
        setSuggestions(groups);
        setOpen(groups.length > 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 200);
  };

  const handleSelect = (slug: string) => {
    setOpen(false);
    setQuery('');
    router.push(`/brand/${slug}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      setOpen(false);
      router.push(`/brand/${query.trim().toLowerCase()}`);
    }
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: 'var(--text-muted)' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search a brand... Nike, Uber, NordVPN"
          className="input-glass pl-11 pr-4"
          role="combobox"
          aria-expanded={open}
          aria-label="Search for promo codes by brand"
          aria-autocomplete="list"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        )}
      </div>

      {geoCountry && (
        <p className="mt-2 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Showing deals for <span style={{ color: 'var(--text-secondary)' }}>{geoCountry}</span> &amp; Global
        </p>
      )}

      {open && suggestions.length > 0 && (
        <div
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border shadow-xl"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
          role="listbox"
        >
          {suggestions.map((group) => (
            <div key={group.label}>
              <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {group.label}
              </div>
              {group.items.map((item) => (
                <button
                  key={item.slug}
                  onClick={() => handleSelect(item.slug)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[--hover-overlay]"
                  role="option"
                  aria-selected={false}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{ backgroundColor: '#d9770620', color: '#f59e0b' }}>
                    {item.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {'activeCodes' in item ? `${item.activeCodes} active code${(item.activeCodes || 0) !== 1 ? 's' : ''}` : item.category || 'Popular'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
