'use client';

import { useState, useEffect } from 'react';

export default function WebsitesPage() {
  const [websites, setWebsites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (filter) params.set('status', filter);
    const res = await window.fetch(`/api/admin/websites?${params}`);
    if (res.ok) setWebsites((await res.json()).websites || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const addWebsite = async () => {
    if (!addUrl.trim()) return;
    setAdding(true);
    try {
      const res = await window.fetch('/api/admin/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: addUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to add website'); setAdding(false); return; }
      setAddUrl('');
      load();
    } catch (err) {
      alert('Network error — check your connection');
    }
    setAdding(false);
  };

  const deleteWebsite = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?\nThis action cannot be undone.`)) return;
    const delOffers = window.confirm('Also delete all offers from this website?');
    try {
      await window.fetch('/api/admin/websites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId: id, deleteOffers: delOffers }),
      });
      load();
    } catch { alert('Failed to delete'); }
  };

  const healthColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Websites</h1>
          <a href="/admin" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Dashboard</a>
        </div>

        <div className="glass-card p-4 mb-4">
          <div className="flex gap-2">
            <input value={addUrl} onChange={e => setAddUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addWebsite()}
              placeholder="https://example.com"
              className="input-glass flex-1 px-3 py-2 text-sm"
            />
            <button onClick={addWebsite} disabled={adding || !addUrl.trim()}
              className="btn-primary px-4 py-2 text-sm whitespace-nowrap">
              {adding ? 'Adding…' : '+ Add Website'}
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {['', 'active', 'paused', 'blocked'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${filter === s ? 'bg-brand-500/20 text-brand-500' : 'text-[var(--text-muted)]'}`}
              style={{ borderColor: 'var(--border)' }}>
              {s || 'All'}
            </button>
          ))}
        </div>

        {loading ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</p> : (
          <div className="space-y-2">
            {websites.map((w: any) => (
              <div key={w._id} className="glass-card flex items-center justify-between py-3 px-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{w.brand?.name || w.domain}</span>
                    <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                      w.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      w.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>{w.status}</span>
                    <span className="text-[10px] rounded-full px-1.5 py-0.5" style={{ backgroundColor: `${healthColor(w.stats?.health_score || 100)}20`, color: healthColor(w.stats?.health_score || 100) }}>
                      {w.stats?.health_score || 100}%
                    </span>
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{w.url}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {w.stats?.offers_found || 0} offers · {w.stats?.success_rate || 0}% success · {w.brand?.category || 'Uncategorized'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 ml-3">
                  <a href={`/admin/websites/${w._id}`} className="rounded-md px-2 py-1 text-[10px] font-medium border hover:bg-blue-500/10"
                    style={{ borderColor: 'var(--border)', color: '#3b82f6' }}>View</a>
                  <button onClick={() => deleteWebsite(w._id, w.brand?.name || w.domain)}
                    className="rounded-md px-2 py-1 text-[10px] font-medium border hover:bg-red-500/10"
                    style={{ borderColor: 'var(--border)', color: '#ef4444' }}>Delete</button>
                </div>
              </div>
            ))}
            {websites.length === 0 && <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No websites yet. Add one above.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
