'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function WebsiteDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await window.fetch(`/api/admin/websites/${id}`);
      if (res.ok) setData(await res.json());
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-base)' }}><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-base)' }}><p className="text-xs" style={{ color: '#ef4444' }}>Website not found</p></div>;

  const w = data.website;
  const healthColor = (s: number) => s >= 80 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <a href="/admin/websites" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Websites</a>
            <h1 className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{w.name || w.domain}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs rounded-full px-2 py-0.5 ${w.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{w.status}</span>
            <span className="text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: `${healthColor(w.stats?.health_score || 100)}20`, color: healthColor(w.stats?.health_score || 100) }}>
              {w.stats?.health_score || 100}% health
            </span>
            <a href={`/admin/offers?website=${id}`} className="btn-glass px-3 py-1.5 text-xs">View Offers</a>
            <a href={w.url} target="_blank" className="btn-glass px-3 py-1.5 text-xs">Open Website</a>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <div className="glass-card p-4"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Offers</p><p className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{data.stats?.offers || 0}</p></div>
          <div className="glass-card p-4"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Blocked</p><p className="text-xl font-bold mt-1" style={{ color: '#ef4444' }}>{data.stats?.blocked || 0}</p></div>
          <div className="glass-card p-4"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Last Scan</p><p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{w.stats?.last_scan ? new Date(w.stats.last_scan).toLocaleDateString() : 'Never'}</p></div>
          <div className="glass-card p-4"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Category</p><p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{w.category || '—'}</p></div>
        </div>

        <div className="glass-card p-4 mb-6">
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Settings</h2>
          <div className="grid gap-3 md:grid-cols-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <div>Frequency: every {w.settings?.scan_frequency || 12}h</div>
            <div>Depth: {w.settings?.crawl_depth || 2}</div>
            <div>JavaScript: {w.settings?.javascript ? 'On' : 'Off'}</div>
            <div>Auto-publish: {w.settings?.auto_publish ? 'On' : 'Off'}</div>
            <div>AI: {w.settings?.ai_enabled ? 'On' : 'Off'}</div>
          </div>
        </div>

        <div className="glass-card p-4 mb-6">
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            URLs ({data.urls?.length || 0})
          </h2>
          <div className="space-y-1">
            {(data.urls || []).map((u: any) => (
              <div key={u._id} className="flex items-center gap-2 text-xs py-1" style={{ color: 'var(--text-muted)' }}>
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${u.kind === 'homepage' ? 'bg-blue-500/15 text-blue-400' : u.kind === 'source_page' ? 'bg-purple-500/15 text-purple-400' : 'bg-gray-500/15'}`}>
                  {u.kind}
                </span>
                <a href={u.url} target="_blank" className="truncate hover:underline">{u.url}</a>
                <span className="shrink-0">{(u.stats?.offers_found || 0)} offers</span>
                {u.source && <span className="shrink-0 text-[10px]">via {u.source}</span>}
              </div>
            ))}
            {(data.urls || []).length === 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No URLs grouped under this website yet.</p>
            )}
          </div>
        </div>

        <div className="glass-card p-4">
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Recent Logs</h2>
          <div className="space-y-1">
            {(data.logs || []).map((l: any) => (
              <div key={l._id} className="flex items-center gap-3 text-xs py-1" style={{ color: 'var(--text-muted)' }}>
                <span>{l.scanned_at ? new Date(l.scanned_at).toLocaleTimeString() : ''}</span>
                <span className="font-semibold" style={{ color: l.status === 'success' ? '#22c55e' : '#ef4444' }}>{l.status}</span>
                <span>{l.offers_found > 0 ? `${l.offers_found} offers` : ''}</span>
              </div>
            ))}
            {(!data.logs || data.logs.length === 0) && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No logs yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
