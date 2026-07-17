'use client';

import { useState, useEffect } from 'react';

export default function ScanJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (filter) params.set('status', filter);
    const res = await window.fetch(`/api/admin/scan-jobs?${params}`);
    if (res.ok) setJobs((await res.json()).jobs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const statusColor = (s: string) => {
    const m: Record<string, string> = {
      queued: '#6b7280', running: '#3b82f6', completed: '#22c55e',
      failed: '#ef4444', blocked: '#ef4444',
    };
    return m[s] || '#6b7280';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Scan Jobs</h1>
          <a href="/admin" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Dashboard</a>
        </div>

        <div className="flex gap-2 mb-4">
          {['', 'queued', 'running', 'completed', 'failed', 'blocked'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${filter === s ? 'bg-brand-500/20 text-brand-500' : 'text-[var(--text-muted)]'}`}
              style={{ borderColor: 'var(--border)' }}>{s || 'All'}</button>
          ))}
        </div>

        {loading ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</p> : (
          <div className="glass-card overflow-hidden">
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {jobs.map((j: any) => (
                <div key={j._id} className="flex items-center gap-4 py-2.5 px-4 text-xs">
                  <span className="w-20 shrink-0 rounded-full text-center px-1.5 py-0.5" style={{ backgroundColor: `${statusColor(j.status)}20`, color: statusColor(j.status) }}>
                    {j.status}
                  </span>
                  <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{j.url}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{j.source_type}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{j.attempts > 0 ? `attempt ${j.attempts}` : ''}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{j.offers_found > 0 ? `${j.offers_found} offers` : ''}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{j.finished_at ? new Date(j.finished_at).toLocaleTimeString() : ''}</span>
                </div>
              ))}
              {jobs.length === 0 && (
                <div className="text-center py-12 text-xs" style={{ color: 'var(--text-muted)' }}>
                  No scan jobs yet. Add a website to create jobs automatically.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
