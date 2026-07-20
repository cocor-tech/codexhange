'use client';

import { useState, useEffect } from 'react';

export default function OffersPage() {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const getWebsiteId = () => new URLSearchParams(window.location.search).get('website');

  const load = async (p: number, s?: string) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '50', page: String(p) });
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('deal_type', typeFilter);
    const q = s ?? search;
    if (q) params.set('q', q);
    const wid = getWebsiteId();
    if (wid) params.set('websiteId', wid);
    const res = await window.fetch(`/api/admin/offers?${params}`);
    if (res.ok) {
      const d = await res.json();
      setOffers(d.offers || []);
      setTotal(d.total || 0);
    }
    setLoading(false);
  };

  useEffect(() => { load(page); }, [page, statusFilter, typeFilter, search]);

  const doSearch = () => {
    setPage(1);
    load(1, searchInput);
  };

  const handleAction = async (id: string, action: string) => {
    if (!window.confirm(` ${action} this offer?`)) return;
    await window.fetch('/api/admin/offers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId: id, status: action }),
    });
    load(page);
  };

  const statusColor = (s: string) => {
    const m: Record<string, string> = { published: '#22c55e', pending_review: '#f59e0b', approved: '#3b82f6', expired: '#ef4444', archived: '#6b7280', blocked: '#ef4444' };
    return m[s] || '#6b7280';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Offers</h1>
          <a href="/admin" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Dashboard</a>
        </div>

        {/* Search bar */}
        <div className="glass-card p-3 mb-4">
          <div className="flex gap-2">
            <input value={searchInput} onChange={e => {
                setSearchInput(e.target.value);
                if (!e.target.value) { setSearch(''); setPage(1); }
              }}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search by store name, URL, code, title..."
              className="input-glass flex-1 px-3 py-2 text-sm" />
            <button onClick={doSearch} className="btn-primary px-4 py-2 text-sm whitespace-nowrap">
              Search
            </button>
            {search && (
              <button onClick={() => { setSearchInput(''); setSearch(''); setPage(1); load(1, ''); }}
                className="btn-glass px-3 py-2 text-xs">Clear</button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          {['', 'published', 'pending_review', 'approved', 'expired', 'archived', 'blocked'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${statusFilter === s ? 'bg-brand-500/20 text-brand-500 border-brand-500/50' : 'text-[var(--text-muted)] border-[var(--border)]'}`}>
              {s || 'All'}
            </button>
          ))}
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            className="ml-auto input-glass px-3 py-1.5 text-xs" style={{ color: 'var(--text-primary)' }}>
            <option value="">All types</option>
            <option value="code">Codes</option>
            <option value="sale">Sales</option>
            <option value="free_trial">Free Trials</option>
            <option value="student_discount">Student</option>
          </select>
        </div>

        {search && <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Search results for: <strong>{search}</strong> ({total} found)</p>}

        {/* Results */}
        {loading ? <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>Loading...</p> : (
          <div className="space-y-2">
            {offers.map((o: any) => (
              <div key={o._id} className="glass-card flex items-center justify-between py-3 px-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={`/admin/offers/${o._id}`} className="text-sm font-semibold hover:underline" style={{ color: 'var(--text-primary)' }}>{o.title}</a>
                    {o.code && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono" style={{ backgroundColor: '#22c55e20', color: '#22c55e' }}>{o.code}</span>}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${statusColor(o.status)}20`, color: statusColor(o.status) }}>{o.status}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{o.confidence}%</span>
                    <span className="text-[10px]" style={{ color: '#3b82f6' }}>{o.deal_type || o.type}</span>
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {o.discount} · {o.store_name || 'Unknown'} · {o.countries?.join(', ') || 'Global'}
                  </p>
                  <a href={o.sourceUrl} target="_blank" className="text-[10px] underline truncate block max-w-full" style={{ color: '#22c55e' }}>{o.sourceUrl}</a>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 ml-3">
                  {o.status !== 'published' && <button onClick={() => handleAction(o._id, 'published')} className="rounded-md px-2 py-1 text-[10px] font-medium border hover:bg-green-500/10" style={{ borderColor: 'var(--border)', color: '#22c55e' }}>Publish</button>}
                  {o.status !== 'archived' && <button onClick={() => handleAction(o._id, 'archived')} className="rounded-md px-2 py-1 text-[10px] font-medium border hover:bg-red-500/10" style={{ borderColor: 'var(--border)', color: '#ef4444' }}>Archive</button>}
                </div>
              </div>
            ))}
            {offers.length === 0 && <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No offers found.</p>}
          </div>
        )}

        {/* Pagination */}
        {total > 50 && (
          <div className="mt-4 flex justify-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-glass px-3 py-1 text-xs disabled:opacity-30">Prev</button>
            <span className="text-xs px-3 py-1" style={{ color: 'var(--text-muted)' }}>Page {page} / {Math.ceil(total / 50) || 1}</span>
            <button disabled={page * 50 >= total} onClick={() => setPage(page + 1)} className="btn-glass px-3 py-1 text-xs disabled:opacity-30">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
