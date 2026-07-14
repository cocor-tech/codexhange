'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CATEGORIES } from '@/lib/brands';
import { VoteButtons } from '@/components/codes/VoteButtons';
import { ShareButton } from '@/components/codes/ShareButton';

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
        <div className="mx-auto max-w-6xl px-6 pb-32 pt-8">
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [didYouMean, setDidYouMean] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [inputType, setInputType] = useState<'url' | 'keyword'>('keyword');
  const [extractedBrand, setExtractedBrand] = useState<{ brand: string; slug: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (q: string, cat: string, p: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (cat && cat !== 'all') params.set('category', cat);
    params.set('page', String(p));

    try {
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      setResults(data.brands || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setDidYouMean(data.didYouMean || []);
      setCategories(data.categories || []);
      setInputType(data.inputType || 'keyword');
      setExtractedBrand(data.extractedBrand || null);

      if (data.noindex) {
        const meta = document.createElement('meta');
        meta.name = 'robots';
        meta.content = 'noindex, follow';
        document.head.appendChild(meta);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    const cat = searchParams.get('category') || 'all';
    setQuery(q);
    setCategory(cat);
    setPage(1);
    doSearch(q, cat, 1);
  }, [searchParams, doSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category && category !== 'all') params.set('category', category);
    router.push(`/search?${params}`);
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (cat && cat !== 'all') params.set('category', cat);
    router.push(`/search?${params}`);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category && category !== 'all') params.set('category', category);
    params.set('page', String(p));
    router.push(`/search?${params}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,#d9770608_0%,transparent_60%)]" />

      <div className="mx-auto max-w-6xl px-6 pb-32 pt-8">
        {/* Search bar */}
        <form onSubmit={handleSearch} className="mx-auto max-w-2xl">
          <div className="relative">
            {inputType === 'url' && extractedBrand ? (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: '#22c55e20' }}>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </span>
              </div>
            ) : (
              <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brands, codes, or paste a store link..."
              className="input-glass pl-11 pr-4 py-3 text-base"
              autoFocus
            />
          </div>
        </form>

        {/* URL detected banner */}
        {inputType === 'url' && extractedBrand && (
          <div className="mt-4 rounded-xl border px-4 py-3 flex items-center justify-between" style={{ borderColor: '#22c55e30', backgroundColor: '#22c55e08' }}>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: '#22c55e15' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-medium" style={{ color: '#22c55e' }}>Link Detected: {extractedBrand.brand}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {total > 0 ? `${total} active code${total !== 1 ? 's' : ''} found` : 'No codes found yet for this store'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Category filters */}
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => handleCategoryChange('all')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              category === 'all'
                ? 'border-brand-500/50 bg-brand-500/10 text-brand-500'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                category === cat
                  ? 'border-brand-500/50 bg-brand-500/10 text-brand-500'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Header */}
        <div className="mt-8 mb-6">
          {total > 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> result{total !== 1 ? 's' : ''} found
              {query && <> for <strong style={{ color: '#f59e0b' }}>&ldquo;{query}&rdquo;</strong></>}
            </p>
          ) : !loading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No results found{query && <> for <strong style={{ color: 'var(--text-primary)' }}>&ldquo;{query}&rdquo;</strong></>}
            </p>
          ) : null}
        </div>

        {/* Did you mean */}
        {didYouMean.length > 0 && results.length === 0 && (
          <div className="glass-card mb-8 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>💡 Did you mean:</p>
            <div className="flex flex-wrap gap-2">
              {didYouMean.map((s: any) => (
                <Link
                  key={s.slug}
                  href={`/brand/${s.slug}`}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:border-brand-500/50 hover:bg-brand-500/10"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  {s.name} <span className="text-[10px] opacity-60">{s.category}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Zero-result fallback (State D — Temu-style) */}
        {results.length === 0 && !loading && (
          <div className="text-center py-8 mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: '#d9770615' }}>
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              We don&rsquo;t have active codes for {extractedBrand ? extractedBrand.brand : '\u201C' + query + '\u201D'} yet
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Be the first to submit a working code for this brand!
            </p>
            <Link
              href={`/auth/register?intent=submit&brand=${encodeURIComponent(extractedBrand?.brand || query)}`}
              className="btn-primary mt-5 inline-flex px-5 py-2.5 text-sm"
            >
              ➕ Be the first to submit a code for {extractedBrand?.brand || query}
            </Link>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6">
            {results.map((brand: any) => (
              <div key={brand.slug} className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <Link href={`/brand/${brand.slug}`} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold" style={{ backgroundColor: '#d9770620', color: '#f59e0b' }}>
                      {brand.name.charAt(0)}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{brand.name}</h3>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {brand.category} · {brand.codes.length} code{brand.codes.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </Link>
                  <Link href={`/brand/${brand.slug}`} className="btn-glass px-3 py-1.5 text-xs">
                    View All
                  </Link>
                </div>

                <div className="space-y-2">
                  {brand.codes.map((code: any) => (
                    <div key={code._id} className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{code.description}</span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          <span className="font-mono font-bold">{code.code}</span> · {code.discount}
                        </p>
                        <div className="mt-1.5">
                          <VoteButtons codeId={code._id} upvotes={code.upvotes || 0} downvotes={code.downvotes || 0} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <ShareButton code={code.code} brand={brand.name} brandSlug={brand.slug} description={code.description} />
                        {code.affiliateLink ? (
                          <a href={code.affiliateLink} target="_blank" rel="nofollow sponsored noopener noreferrer" className="btn-primary px-3 py-1.5 text-xs whitespace-nowrap">
                            Get Deal
                          </a>
                        ) : code.link ? (
                          <a href={`/go?url=${encodeURIComponent(code.link)}&ref=${brand.slug}`} target="_blank" rel="nofollow sponsored noopener noreferrer" className="btn-primary px-3 py-1.5 text-xs whitespace-nowrap">
                            Use Code
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="mt-8 flex justify-center items-center gap-3">
            <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1} className="btn-glass px-4 py-2 text-xs disabled:opacity-30">← Prev</button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {page} of {pages}</span>
            <button onClick={() => handlePageChange(page + 1)} disabled={page >= pages} className="btn-glass px-4 py-2 text-xs disabled:opacity-30">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
