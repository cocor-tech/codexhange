'use client';

import { useState, useEffect } from 'react';
import { adminHeaders } from '@/lib/adminFetch';

type Source = {
  _id: string;
  name: string;
  url: string;
  type: string;
  frequency_hours: number;
  scanLevel?: number;
  avgScanTime?: number;
  nextScanAt?: string;
  status: string;
  stats?: { brands_found: number; offers_found: number; last_scan?: string };
  createdAt?: string;
};

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchText, setBatchText] = useState('');
  const [batchMsg, setBatchMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [singleUrl, setSingleUrl] = useState('');
  const [singleName, setSingleName] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await window.fetch('/api/admin/sources?limit=200', { headers: adminHeaders(false) });
    if (res.ok) setSources((await res.json()).sources || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const msg = (s: string) => { setBatchMsg(s); setTimeout(() => setBatchMsg(''), 5000); };

  const seedBatch = async () => {
    const lines = batchText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setBusy(true);
    const batch = lines.map(l => {
      const [url, name] = l.split('|');
      return { url: url.trim(), name: (name || '').trim() || undefined };
    });
    try {
      const res = await window.fetch('/api/admin/sources', {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({ batch }),
      });
      const d = await res.json();
      if (res.ok) {
        msg(`✅ ${d.created} added, ${d.skipped} skipped — ${d.total} total`);
        setBatchText('');
        load();
      } else msg(`❌ ${d.error || 'Failed'}`);
    } catch { msg('❌ Network error'); }
    setBusy(false);
  };

  const addSingle = async () => {
    if (!singleUrl) return;
    setBusy(true);
    try {
      const res = await window.fetch('/api/admin/sources', {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({ url: singleUrl, name: singleName || undefined }),
      });
      const d = await res.json();
      if (res.ok) { msg(`✅ Added ${d.source?.name}`); setSingleUrl(''); setSingleName(''); load(); }
      else msg(`❌ ${d.error || 'Failed'}`);
    } catch { msg('❌ Network error'); }
    setBusy(false);
  };

  const toggleStatus = async (s: Source) => {
    const next = s.status === 'active' ? 'paused' : 'active';
    await window.fetch('/api/admin/sources', {
      method: 'PATCH', headers: adminHeaders(),
      body: JSON.stringify({ sourceId: s._id, status: next }),
    });
    load();
  };

  const remove = async (s: Source) => {
    if (!window.confirm(`Remove ${s.name}?`)) return;
    await window.fetch('/api/admin/sources', {
      method: 'DELETE', headers: adminHeaders(),
      body: JSON.stringify({ sourceId: s._id }),
    });
    load();
  };

  const levelColor = (l?: number) => {
    const m: Record<number, string> = { 1: '#22c55e', 2: '#f59e0b', 3: '#ef4444' };
    return m[l || 2] || '#6b7280';
  };
  const nextScan = (s: Source) => {
    if (!s.nextScanAt) return '—';
    const d = new Date(s.nextScanAt);
    const diff = Math.round((d.getTime() - Date.now()) / 3600000);
    if (diff < 0) return 'due';
    return `${diff}h`;
  };
  const statusColor = (s: string) => {
    const m: Record<string, string> = { active: '#22c55e', paused: '#f59e0b', blocked: '#ef4444' };
    return m[s] || '#6b7280';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-7xl px-6 py-6">
<div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Crawl Sources</h1>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>The coupon/deal aggregator sites the bot crawls. Stored only in your DB.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await window.fetch('/api/admin/scan-jobs/trigger', {
                      method: 'POST', headers: adminHeaders(),
                      body: JSON.stringify({ fullDiscovery: false }),
                    });
                    const d = await res.json().catch(() => ({}));
                    msg(res.ok
                      ? `✅ Bot run triggered — view progress at ${d.runsUrl || 'GitHub Actions'}`
                      : `❌ ${d.error || 'Failed'}`);
                  } catch { msg('❌ Network error'); }
                  setBusy(false);
                }}
                className="btn-primary px-4 py-2 text-xs whitespace-nowrap"
              >{busy ? 'Triggering…' : '▶ Run Bot Now'}</button>
              <a href="/admin" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Dashboard</a>
            </div>
          </div>

        {batchMsg && <div className="glass-card p-3 mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>{batchMsg}</div>}

        {/* Batch seed */}
        <div className="glass-card p-4 mb-6">
          <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Batch Add (paste list)</h2>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>One per line: <code className="text-brand-500">https://site.com</code> or <code className="text-brand-500">https://site.com|Display Name</code></p>
          <textarea
            value={batchText}
            onChange={e => setBatchText(e.target.value)}
            rows={8}
            placeholder={'https://www.couponsite.com|Coupon Site\nhttps://dealsite.net|Deal Site\n...'}
            className="input-glass w-full px-3 py-2 text-sm font-mono"
            style={{ color: 'var(--text-primary)' }}
          />
          <button onClick={seedBatch} disabled={busy || !batchText.trim()} className="btn-primary px-4 py-2 text-sm mt-3">
            {busy ? 'Seeding…' : 'Seed Sources'}
          </button>
        </div>

        {/* Single add */}
        <div className="glass-card p-4 mb-6">
          <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Add One</h2>
          <div className="flex gap-2">
            <input
              value={singleUrl}
              onChange={e => setSingleUrl(e.target.value)}
              placeholder="https://example.com"
              className="input-glass flex-1 px-3 py-2 text-sm"
              style={{ color: 'var(--text-primary)' }}
            />
            <input
              value={singleName}
              onChange={e => setSingleName(e.target.value)}
              placeholder="Name (optional)"
              className="input-glass w-48 px-3 py-2 text-sm"
              style={{ color: 'var(--text-primary)' }}
            />
            <button onClick={addSingle} disabled={busy || !singleUrl} className="btn-primary px-4 py-2 text-sm whitespace-nowrap">Add</button>
          </div>
        </div>

        {/* List */}
        {loading ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</p> : (
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-2 border-b text-xs font-semibold flex" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              <span className="flex-1">Name</span>
              <span className="w-16">Type</span>
              <span className="w-12">Freq</span>
              <span className="w-12">Level</span>
              <span className="w-16">Status</span>
              <span className="w-16">Brands</span>
              <span className="w-16">Offers</span>
              <span className="w-20">Next</span>
              <span className="w-24">Last scan</span>
              <span className="w-24 text-right">Actions</span>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {sources.map(s => (
                <div key={s._id} className="flex items-center gap-2 py-2.5 px-4 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                    <p className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.url}</p>
                  </div>
                  <span className="w-16 capitalize" style={{ color: 'var(--text-muted)' }}>{s.type || 'promo'}</span>
                  <span className="w-12" style={{ color: 'var(--text-muted)' }}>{s.frequency_hours}h</span>
                  <span className="w-12 text-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: `${levelColor(s.scanLevel)}20`, color: levelColor(s.scanLevel) }}>
                    L{s.scanLevel || 2}
                  </span>
                  <button onClick={() => toggleStatus(s)} className="w-16 rounded-full text-center px-1.5 py-0.5 border" style={{ backgroundColor: `${statusColor(s.status)}20`, color: statusColor(s.status), borderColor: 'var(--border)' }}>
                    {s.status}
                  </button>
                  <span className="w-16 text-center" style={{ color: 'var(--text-muted)' }}>{s.stats?.brands_found || 0}</span>
                  <span className="w-16 text-center" style={{ color: 'var(--text-muted)' }}>{s.stats?.offers_found || 0}</span>
                  <span className="w-20" style={{ color: 'var(--text-muted)' }}>{nextScan(s)}{s.avgScanTime ? ` · ${s.avgScanTime.toFixed(1)}s` : ''}</span>
                  <span className="w-24" style={{ color: 'var(--text-muted)' }}>{s.stats?.last_scan ? new Date(s.stats.last_scan).toLocaleDateString() : '—'}</span>
                  <span className="w-24 text-right">
                    <button onClick={() => remove(s)} className="text-[10px] hover:underline" style={{ color: '#ef4444' }}>Remove</button>
                  </span>
                </div>
              ))}
              {sources.length === 0 && (
                <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>No sources yet — paste the list above and hit Seed.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}