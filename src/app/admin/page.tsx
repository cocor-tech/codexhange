'use client';

import { useState, useEffect } from 'react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

type Tab = 'categories' | 'brands' | 'services' | 'offers' | 'pending' | 'users';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('categories');
  const [actionMsg, setActionMsg] = useState('');

  const msg = (s: string) => { setActionMsg(s); setTimeout(() => setActionMsg(''), 3000); };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Logo href="/" className="text-base" />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-xs rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: '#ef444420', color: '#ef4444' }}>Admin</span>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 pb-32">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin</h1>

        <div className="mt-4 flex gap-1 rounded-xl p-1 border flex-wrap" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
          {(['categories', 'brands', 'services', 'offers', 'pending', 'users'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold capitalize transition-all ${
                tab === t ? 'bg-brand-500/20 text-brand-500' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {actionMsg && (
          <div className="mt-3 rounded-lg px-4 py-2 text-xs" style={{ backgroundColor: '#22c55e15', color: '#22c55e' }}>{actionMsg}</div>
        )}

        {tab === 'categories' && <CategoriesTab onMsg={msg} />}
        {tab === 'brands' && <BrandsTab onMsg={msg} />}
        {tab === 'services' && <ServicesTab onMsg={msg} />}
        {tab === 'offers' && <OffersTab onMsg={msg} />}
        {tab === 'pending' && <PendingTab onMsg={msg} />}
        {tab === 'users' && <UsersTab onMsg={msg} />}
      </main>
    </div>
  );
}

function CategoriesTab({ onMsg }: { onMsg: (s: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = async () => {
    setLoading(true);
    const res = await window.fetch('/api/admin/categories');
    if (res.ok) setItems((await res.json()).categories);
    setLoading(false);
  };

  useEffect(() => { loadItems(); }, []);

  const handleCreate = async () => {
    const name = prompt('Category name:');
    if (!name) return;
    const res = await window.fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) { onMsg('Category created'); loadItems(); }
    else onMsg('Failed to create');
  };

  return (
    <div className="mt-6">
      <div className="flex gap-2 mb-4">
        <button onClick={handleCreate} className="btn-glass px-3 py-2 text-xs font-medium">+ New Category</button>
      </div>
      {loading ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</p> : (
        <div className="space-y-2">
          {items.map((c: any) => (
            <div key={c._id} className="glass-card flex items-center justify-between py-2 px-4">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>/ {c.slug}</span>
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Order: {c.order}</div>
            </div>
          ))}
          {items.length === 0 && <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No categories. Add one to organize brands.</p>}
        </div>
      )}
    </div>
  );
}

function BrandsTab({ onMsg }: { onMsg: (s: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  const loadBrands = async (p: number, s: string) => {
    const params = new URLSearchParams({ page: String(p), limit: '50' });
    if (s) params.set('search', s);
    const res = await window.fetch(`/api/admin/brands?${params}`);
    if (res.ok) {
      const d = await res.json();
      setItems(d.brands); setTotal(d.total); setPage(d.page);
    }
  };

  useEffect(() => { loadBrands(page, search); }, [page]);

  const triggerDiscover = async (brandId: string, name: string) => {
    onMsg(`Queued: ${name}`);
    // In production, this would call the bot API
    await window.fetch('/api/bot/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId }),
    });
  };

  return (
    <div className="mt-6">
      <div className="flex gap-2 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search brands..." className="input-glass flex-1 px-3 py-2 text-xs"
          onKeyDown={e => e.key === 'Enter' && loadBrands(1, search)} />
      </div>
      <div className="space-y-2">
        {items.map((b: any) => (
          <div key={b._id} className="glass-card flex items-center justify-between py-2 px-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{b.name}</span>
                {!b.active && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>INACTIVE</span>}
              </div>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{b.website}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Discovery: {b.discovery?.enabled ? 'On' : 'Off'} · Crawl delay: {b.discovery?.crawlDelay || 3000}ms
              </p>
            </div>
            <button onClick={() => triggerDiscover(b._id, b.name)}
              className="rounded-md px-2 py-1 text-[10px] font-medium border shrink-0 ml-3 hover:bg-brand-500/10"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              Discover
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-2">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-glass px-3 py-1 text-xs disabled:opacity-30">Prev</button>
        <span className="text-xs px-3 py-1" style={{ color: 'var(--text-muted)' }}>Page {page}</span>
        <button disabled={page * 50 >= total} onClick={() => setPage(page + 1)} className="btn-glass px-3 py-1 text-xs disabled:opacity-30">Next</button>
      </div>
    </div>
  );
}

function ServicesTab({ onMsg }: { onMsg: (s: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadSvcs = async (p: number) => {
    const params = new URLSearchParams({ page: String(p), limit: '50' });
    const res = await window.fetch(`/api/admin/services?${params}`);
    if (res.ok) { const d = await res.json(); setItems(d.services); setTotal(d.total); setPage(d.page); }
  };

  useEffect(() => { loadSvcs(page); }, [page]);

  return (
    <div className="mt-6">
      <div className="space-y-2">
        {items.map((s: any) => (
          <div key={s._id} className="glass-card flex items-center justify-between py-2 px-4">
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
              <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>Brand: {s.brandId}</span>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>/services/{s.slug}</p>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No services. Create brands first, then add services.</p>}
      </div>
      <div className="mt-4 flex justify-center gap-2">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-glass px-3 py-1 text-xs disabled:opacity-30">Prev</button>
        <span className="text-xs px-3 py-1" style={{ color: 'var(--text-muted)' }}>Page {page}</span>
        <button disabled={page * 50 >= total} onClick={() => setPage(page + 1)} className="btn-glass px-3 py-1 text-xs disabled:opacity-30">Next</button>
      </div>
    </div>
  );
}

function OffersTab({ onMsg }: { onMsg: (s: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('published');

  const loadOffers = async (p: number) => {
    const params = new URLSearchParams({ page: String(p), limit: '50' });
    if (statusFilter) params.set('status', statusFilter);
    const res = await window.fetch(`/api/admin/offers?${params}`);
    if (res.ok) { const d = await res.json(); setItems(d.offers); setTotal(d.total); setPage(d.page); }
  };

  useEffect(() => { loadOffers(page); }, [page, statusFilter]);

  const handleOfferAction = async (offerId: string, action: string) => {
    const res = await window.fetch('/api/admin/offers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId, status: action }),
    });
    if (res.ok) { onMsg(`Offer ${action}`); loadOffers(page); }
    else onMsg('Action failed');
  };

  return (
    <div className="mt-6">
      <div className="flex gap-2 mb-4">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="input-glass px-3 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>
          <option value="published">Published</option>
          <option value="approved">Approved</option>
          <option value="pending_review">Pending Review</option>
          <option value="discovered">Discovered</option>
          <option value="verified">Verified</option>
          <option value="expired">Expired</option>
          <option value="archived">Archived</option>
          <option value="">All</option>
        </select>
      </div>
      <div className="space-y-2">
        {items.map((o: any) => (
          <div key={o._id} className="glass-card flex items-center justify-between py-2 px-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{o.title}</span>
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                  o.status === 'published' ? 'bg-green-500/20 text-green-400' :
                  o.status === 'pending_review' ? 'bg-yellow-500/20 text-yellow-400' :
                  o.status === 'expired' ? 'bg-red-500/20 text-red-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>{o.status}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{o.confidence}%</span>
              </div>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {o.discount} · {Array.isArray(o.type) ? o.type.join(', ') : o.type} · {o.countries?.join(', ') || 'Global'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 ml-3">
              {o.status !== 'published' && <button onClick={() => handleOfferAction(o._id, 'published')} className="rounded-md px-2 py-1 text-[10px] font-medium border hover:bg-green-500/10" style={{ borderColor: 'var(--border)', color: '#22c55e' }}>Publish</button>}
              {o.status !== 'archived' && <button onClick={() => handleOfferAction(o._id, 'archived')} className="rounded-md px-2 py-1 text-[10px] font-medium border hover:bg-red-500/10" style={{ borderColor: 'var(--border)', color: '#ef4444' }}>Archive</button>}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No offers found</p>}
      </div>
      <div className="mt-4 flex justify-center gap-2">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-glass px-3 py-1 text-xs disabled:opacity-30">Prev</button>
        <span className="text-xs px-3 py-1" style={{ color: 'var(--text-muted)' }}>Page {page}</span>
        <button disabled={page * 50 >= total} onClick={() => setPage(page + 1)} className="btn-glass px-3 py-1 text-xs disabled:opacity-30">Next</button>
      </div>
    </div>
  );
}

function PendingTab({ onMsg }: { onMsg: (s: string) => void }) {
  const [items, setItems] = useState<any[]>([]);

  const loadPending = async () => {
    const res = await window.fetch('/api/admin/offers?status=pending_review&limit=50');
    if (res.ok) setItems((await res.json()).offers);
  };

  useEffect(() => { loadPending(); }, []);

  const handleReview = async (offerId: string, status: string) => {
    await window.fetch('/api/admin/offers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId, status }),
    });
    onMsg(`Offer ${status}`);
    loadPending();
  };

  return (
    <div className="mt-6">
      <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Pending Review ({items.length})</h2>
      <div className="space-y-2">
        {items.map((o: any) => (
          <div key={o._id} className="glass-card flex items-center justify-between py-2 px-4 border-l-2" style={{ borderLeftColor: '#f59e0b' }}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{o.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#f59e0b20', color: '#f59e0b' }}>{o.confidence}%</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.discount} · via {o.sourceReliability} · {Array.isArray(o.type) ? o.type.join(', ') : o.type}</p>
              {o.code && <p className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>Code: {o.code}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 ml-3">
              <button onClick={() => handleReview(o._id, 'approved')} className="rounded-md px-2 py-1 text-[10px] font-medium border hover:bg-green-500/10" style={{ borderColor: 'var(--border)', color: '#22c55e' }}>Approve</button>
              <button onClick={() => handleReview(o._id, 'archived')} className="rounded-md px-2 py-1 text-[10px] font-medium border hover:bg-red-500/10" style={{ borderColor: 'var(--border)', color: '#ef4444' }}>Reject</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No pending reviews</p>}
      </div>
    </div>
  );
}

function UsersTab({ onMsg }: { onMsg: (s: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadUsers = async (p: number) => {
    const res = await window.fetch(`/api/admin/users?page=${p}&limit=50`);
    if (res.ok) { const d = await res.json(); setItems(d.users); setTotal(d.total); setPage(d.page); }
  };

  useEffect(() => { loadUsers(page); }, [page]);

  const toggleAdmin = async (userId: string) => {
    await window.fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, action: 'toggle-admin' }) });
    loadUsers(page);
  };

  return (
    <div className="mt-6">
      <div className="space-y-2">
        {items.map((u: any) => (
          <div key={u._id} className="glass-card flex items-center justify-between py-2 px-4">
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{u.name || u.email}</span>
              {u.isAdmin && <span className="text-[10px] ml-2 rounded-full px-1.5 py-0.5 font-bold" style={{ backgroundColor: '#ef444420', color: '#ef4444' }}>ADMIN</span>}
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
            </div>
            <button onClick={() => toggleAdmin(u._id)} className="rounded-md px-3 py-1 text-xs font-medium border shrink-0 ml-3" style={{ borderColor: 'var(--border)', color: u.isAdmin ? '#ef4444' : 'var(--text-muted)' }}>
              {u.isAdmin ? 'Revoke Admin' : 'Make Admin'}
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-2">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-glass px-3 py-1 text-xs disabled:opacity-30">Prev</button>
        <span className="text-xs px-3 py-1" style={{ color: 'var(--text-muted)' }}>Page {page}</span>
        <button disabled={page * 50 >= total} onClick={() => setPage(page + 1)} className="btn-glass px-3 py-1 text-xs disabled:opacity-30">Next</button>
      </div>
    </div>
  );
}
