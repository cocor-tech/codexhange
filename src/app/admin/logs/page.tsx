'use client';

import { useState, useEffect } from 'react';

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);

  const load = async () => {
    const res = await window.fetch('/api/admin/logs');
    if (res.ok) setLogs((await res.json()).logs || []);
  };

  useEffect(() => { load(); }, []);

  const statusColor = (s: string) => {
    if (s === 'success') return '#22c55e';
    if (s === 'timeout' || s === 'unreachable' || s === 'failed') return '#ef4444';
    return '#f59e0b';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Bot Logs</h1>
          <div className="flex gap-2">
            <button onClick={load} className="btn-glass px-3 py-1.5 text-xs">Refresh</button>
            <a href="/admin" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Dashboard</a>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {logs.map((l: any) => (
              <div key={l._id} className="flex items-center gap-4 py-2.5 px-4 text-xs">
                <span className="w-16 shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {l.scanned_at ? new Date(l.scanned_at).toLocaleTimeString() : ''}
                </span>
                <span className="w-28 shrink-0 font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{l.brand_name}</span>
                <span className="w-20 shrink-0 text-center rounded-full px-1.5" style={{ backgroundColor: `${statusColor(l.status)}20`, color: statusColor(l.status) }}>
                  {l.status}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {l.offers_found > 0 ? `${l.offers_found} offers` : ''}
                  {l.offers_submitted ? ` · ${l.offers_submitted} submitted` : ''}
                  {l.error ? ` · ${l.error}` : ''}
                </span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-center py-12 text-xs" style={{ color: 'var(--text-muted)' }}>
                No bot activity yet. Add a website and run a scan to see logs here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
