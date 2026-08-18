'use client';

import { useState, useEffect } from 'react';
import { adminHeaders } from '@/lib/adminFetch';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        window.fetch('/api/admin/stats', { headers: adminHeaders(false) }).then(r => r.json()),
        window.fetch('/api/admin/logs', { headers: adminHeaders(false) }).then(r => r.json().catch(() => ({ logs: [] }))),
      ]);
      setStats(s);
      setLogs(l.logs || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-base)' }}>
    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</p>
  </div>;

  const total = stats ? Object.values(stats as Record<string, any>).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0) : 0;
  const successLogs = logs.filter(l => l.status === 'success').length;
  const failedLogs = logs.filter(l => l.status !== 'success').length;
  const successRate = logs.length > 0 ? Math.round((successLogs / logs.length) * 100) : 0;

  const chartData = [
    { label: 'Published', value: parseInt(stats?.publishedOffers || '0'), color: '#22c55e' },
    { label: 'Pending', value: parseInt(stats?.pendingReview || '0'), color: '#f59e0b' },
    { label: 'Blocked', value: parseInt(stats?.blockedSites || '0'), color: '#ef4444' },
  ];
  const chartTotal = chartData.reduce((a, c) => a + c.value, 0) || 1;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Analytics</h1>
          <div className="flex gap-2">
            <button onClick={load} className="btn-glass px-3 py-1.5 text-xs">Refresh</button>
            <a href="/admin" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Dashboard</a>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <MetricCard label="Offers" value={stats?.totalOffers || 0} color="#22c55e" />
          <MetricCard label="Published" value={stats?.publishedOffers || 0} color="#22c55e" />
          <MetricCard label="Brands" value={stats?.totalBrands || 0} color="#a855f7" />
          <MetricCard label="Websites" value={stats?.totalWebsites || 0} color="#3b82f6" />
          <MetricCard label="Categories" value={stats?.totalCategories || 0} color="#ec4899" />
          <MetricCard label="User Codes" value={stats?.totalCodes || 0} color="#3b82f6" />
          <MetricCard label="Clicks" value={stats?.totalClicks || 0} color="#f59e0b" />
          <MetricCard label="Upvotes/Down" value={`${stats?.totalUpvotes || 0}/${stats?.totalDownvotes || 0}`} color="#22c55e" />
        </div>

        {/* Pie chart */}
        <div className="grid gap-6 lg:grid-cols-2 mb-6">
          <div className="glass-card p-5">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Offer Status Distribution</h2>
            <div className="flex items-center gap-6">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
                  {chartData.reduce((acc, item, i) => {
                    const pct = (item.value / chartTotal) * 100;
                    const prevPct = acc.reduce((a: number, c: typeof item) => a + (c.value / chartTotal) * 100, 0);
                    const offset = (prevPct / 100) * 283;
                    const length = (pct / 100) * 283;
                    if (item.value === 0) return acc;
                    acc.push(
                      <circle key={item.label} cx="18" cy="18" r="15.9" fill="none" stroke={item.color}
                        strokeWidth="3" strokeDasharray={`${length} ${283 - length}`}
                        strokeDashoffset={-offset} />
                    );
                    return acc;
                  }, [] as any[])}
                </svg>
              </div>
              <div className="space-y-2">
                {chartData.map(d => (
                  <div key={d.label} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{d.label}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{d.value} ({Math.round((d.value / chartTotal) * 100)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bot success rate */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Bot Scan Success Rate</h2>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg-secondary)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={successRate >= 60 ? '#22c55e' : '#f59e0b'}
                    strokeWidth="3" strokeDasharray={`${(successRate / 100) * 283} ${283 - (successRate / 100) * 283}`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold" style={{ color: successRate >= 60 ? '#22c55e' : '#f59e0b' }}>{successRate}%</span>
                </div>
              </div>
              <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                <p><span style={{ color: '#22c55e' }}>{successLogs}</span> successful</p>
                <p><span style={{ color: '#ef4444' }}>{failedLogs}</span> failed</p>
                <p><span style={{ color: 'var(--text-secondary)' }}>{logs.length}</span> total scans</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="glass-card p-5 mb-6">
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Platform Overview</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <BarChart label="Brands" value={parseInt(stats?.totalBrands || '0')} max={Math.max(parseInt(stats?.totalBrands || '1'), 1)} color="#a855f7" />
            <BarChart label="Websites" value={parseInt(stats?.totalWebsites || '0')} max={Math.max(parseInt(stats?.totalBrands || '1'), 1)} color="#3b82f6" />
            <BarChart label="Offers" value={parseInt(stats?.totalOffers || '0')} max={Math.max(parseInt(stats?.totalOffers || '1'), 1)} color="#22c55e" />
            <BarChart label="User Codes" value={parseInt(stats?.totalCodes || '0')} max={Math.max(parseInt(stats?.totalCodes || '1'), 1)} color="#f59e0b" />
          </div>
        </div>

        {/* Recent activity */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Bot Activity</h2>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {logs.slice(0, 30).map((l: any) => (
              <div key={l._id} className="flex items-center gap-3 text-xs py-1" style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: l.status === 'success' ? '#22c55e' : '#ef4444' }}>●</span>
                <span className="w-20 shrink-0">{l.scanned_at ? new Date(l.scanned_at).toLocaleDateString() : ''}</span>
                <span className="w-24 truncate font-medium" style={{ color: 'var(--text-primary)' }}>{l.brand_name || '?'}</span>
                <span>{l.status}</span>
                {l.offers_found > 0 && <span className="text-green-500">{l.offers_found} offers</span>}
                {l.error && <span className="truncate max-w-[200px]" style={{ color: '#ef4444' }}>{l.error}</span>}
              </div>
            ))}
            {logs.length === 0 && <p className="text-xs py-4" style={{ color: 'var(--text-muted)' }}>No bot activity yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="glass-card p-4">
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  );
}

function BarChart({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-3 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
