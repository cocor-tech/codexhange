'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { classifyInput } from '@/lib/search';

interface SuggestionItem {
  slug: string;
  name: string;
  activeCodes?: number;
  category?: string;
}

interface SuggestionGroup {
  type: 'brand' | 'category';
  label: string;
  items: SuggestionItem[];
}

const TRENDING_TAGS = [
  { label: 'NordVPN', href: '/brand/nordvpn' },
  { label: 'Jumia', href: '/brand/jumia' },
  { label: 'Hostinger', href: '/brand/hostinger' },
  { label: 'Amazon', href: '/brand/amazon' },
  { label: 'UberEats', href: '/brand/ubereats' },
  { label: 'Nike', href: '/brand/nike' },
];

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const inputInfo = query.trim() ? classifyInput(query.trim()) : null;
  const isUrl = inputInfo?.type === 'url';
  const totalItems = suggestions.reduce((n, g) => n + g.items.length, 0);

  const search = useCallback((q: string) => {
    if (q.length < 1) {
      setSuggestions([]);
      setSelectedIdx(-1);
      setOpen(false);
      return;
    }
    setLoading(true);
    fetch(`/api/brands/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => {
        const groups: SuggestionGroup[] = data.suggestions || [];
        if (groups.length === 0 && data.brands?.length > 0) {
          groups.push({ type: 'brand', label: '🏢 Brands', items: data.brands });
        }
        if (groups.length > 0) {
          const queryParam = encodeURIComponent(q);
          groups.push({
            type: 'brand',
            label: '',
            items: [{ slug: 'view-all', name: `View all results for "${q}" →`, activeCodes: 0 }],
          });
        }
        setSuggestions(groups);
        setOpen(groups.length > 0);
        setSelectedIdx(-1);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 150);
  };

  const handleSelect = (item: SuggestionItem) => {
    setOpen(false);
    setQuery('');
    if (item.slug === 'view-all') {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    } else {
      router.push(`/brand/${item.slug}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      if (selectedIdx >= 0 && selectedIdx < totalItems) {
        let idx = 0;
        for (const g of suggestions) {
          if (g.items.length + idx > selectedIdx) {
            handleSelect(g.items[selectedIdx - idx]);
            return;
          }
          idx += g.items.length;
        }
      }
      if (query.trim()) {
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const showDropdown = open && (focused || query.length > 0);
  const showTrending = showDropdown && query.length === 0 && focused;

  return (
    <div ref={ref} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        {isUrl ? (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: '#22c55e20' }}>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </span>
            <span className="text-[10px] font-medium" style={{ color: '#22c55e' }}>Link detected</span>
          </div>
        ) : (
          <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { setFocused(true); if (!query) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={isUrl ? `Analyzing ${inputInfo?.extracted?.brand || 'link'}...` : 'Paste any online store link or type a brand name...'}
          className="input-glass pl-24 pr-12 py-3.5 text-sm"
          role="combobox"
          aria-expanded={showDropdown}
          aria-label="Search for promo codes by brand"
          aria-autocomplete="list"
        />
        {loading ? (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : query.trim() && (
          <button
            onClick={() => { setOpen(false); router.push(`/search?q=${encodeURIComponent(query.trim())}`); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-7 w-7 rounded-lg transition-colors hover:bg-brand-500/20"
            style={{ color: '#f59e0b' }}
            aria-label="Search"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* State A: Trending tags when idle */}
      {!focused && !query && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Popular:</span>
          {TRENDING_TAGS.map((t) => (
            <button
              key={t.href}
              onClick={() => router.push(t.href)}
              className="rounded-full border px-3 py-1 text-[11px] font-medium transition-colors hover:border-brand-500/50 hover:bg-brand-500/10"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              🏷️ {t.label}
            </button>
          ))}
        </div>
      )}

      {showDropdown && (
        <div
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border shadow-xl"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
          role="listbox"
        >
          {showTrending ? (
            /* State A: Trending on empty focus */
            <div>
              <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                🔥 Trending Brands
              </div>
              {TRENDING_TAGS.map((t) => (
                <button
                  key={t.href}
                  onClick={() => { setOpen(false); router.push(t.href); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[--hover-overlay]"
                  role="option"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{ backgroundColor: '#d9770620', color: '#f59e0b' }}>
                    {t.label.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{t.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Popular brand</p>
                  </div>
                </button>
              ))}
            </div>
          ) : suggestions.length > 0 ? (
            /* State B + C: Search results */
            suggestions.map((group, gi) => {
              let startIdx = 0;
              for (let i = 0; i < gi; i++) startIdx += suggestions[i].items.length;

              return (
                <div key={group.label || group.type}>
                  {group.label && (
                    <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      {group.label}
                    </div>
                  )}
                  {group.items.map((item, ii) => {
                    const globalIdx = startIdx + ii;
                    return (
                      <button
                        key={item.slug + (item.category || '')}
                        onClick={() => handleSelect(item)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                          globalIdx === selectedIdx ? 'bg-[--hover-overlay]' : 'hover:bg-[--hover-overlay]'
                        }`}
                        role="option"
                        aria-selected={globalIdx === selectedIdx}
                      >
                        {item.slug === 'view-all' ? (
                          <span className="w-full text-center text-xs font-medium" style={{ color: '#f59e0b' }}>
                            {item.name}
                          </span>
                        ) : (
                          <>
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{ backgroundColor: '#d9770620', color: '#f59e0b' }}>
                              {item.name.charAt(0)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {'activeCodes' in item && item.activeCodes !== undefined
                                  ? `${item.activeCodes} active code${item.activeCodes !== 1 ? 's' : ''}`
                                  : item.category || 'Popular'}
                              </p>
                            </div>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          ) : (
            /* State D: Zero-result (copy paste fallback) */
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                No active codes found for &ldquo;{query}&rdquo;
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Be the first to contribute a promo code for this brand!
              </p>
              <button
                onClick={() => {
                  setOpen(false);
                  router.push(`/search?q=${encodeURIComponent(query)}`);
                }}
                className="mt-3 rounded-lg border px-4 py-2 text-xs font-medium transition-colors hover:border-brand-500/50 hover:bg-brand-500/10"
                style={{ borderColor: 'var(--border)', color: '#f59e0b' }}
              >
                Browse Similar Offers &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {!focused && !query && (
        <p className="mt-2 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Press <kbd className="rounded border px-1 py-0.5 font-mono text-[10px]" style={{ borderColor: 'var(--border)' }}>/</kbd> to search
        </p>
      )}
    </div>
  );
}
