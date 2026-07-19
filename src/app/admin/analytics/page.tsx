'use client';

import { useState, useEffect } from 'react';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [offersRes, sitesRes, jobsRes, logsRes] = await Promise.all([
        window.fetch('/api/admin/offers?limit=1').then(r => r.json()),
        window.fetch('/api/admin/websites').then(r => r.json()),
        window.fetch('/api/admin/scan-jobs?limit=1').then(r => r.json()),
        window.fetch('/api/admin/logs').then(r => r.json()),
      ]);
      setData({
        totalOffers: offersRes.total || 0,
        totalSites: sitesRes.total || 0,
        totalJobs: jobsRes.total || 0,
        logs: logsRes.logs || [],
      });
    } catch {}
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const successRate = data?.logs?.length
    ? Math.round((data.logs.filter((l: any) => l.status === 'success').length / data.logs.length) * 100)
    : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Analytics</h1>
          <div className="flex gap-2 items-center">
            <button onClick={load} disabled={refreshing} className="btn-glass px-3 py-1.5 text-xs">{refreshing ? 'Refreshing…' : 'Refresh'}</button>
            <a href="/admin" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Dashboard</a>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <MetricCard label="Total Websites" value={data?.totalSites || 0} color="#3b82f6" />
          <MetricCard label="Total Offers" value={data?.totalOffers || 0} color="#22c55e" />
          <MetricCard label="Scan Jobs" value={data?.totalJobs || 0} color="#a855f7" />
          <MetricCard label="Success Rate" value={`${successRate}%`} color={successRate >= 60 ? '#22c55e' : '#f59e0b'} />
        </div>

        <div className="glass-card p-5 mb-6">
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Activity</h2>
          <div className="space-y-1">
            {(data?.logs || []).slice(0, 15).map((l: any) => (
              <div key={l._id} className="flex items-center gap-3 text-xs py-1" style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: l.status === 'success' ? '#22c55e' : l.status === 'timeout' ? '#ef4444' : '#f59e0b' }}>●</span>
                <span className="w-24">{l.scanned_at ? new Date(l.scanned_at).toLocaleTimeString() : ''}</span>
                <span className="w-28 truncate font-semibold" style={{ color: 'var(--text-primary)' }}>{l.brand_name}</span>
                <span>{l.status}</span>
                <span>{l.offers_found > 0 ? `${l.offers_found} offers` : ''}</span>
              </div>
            ))}
            {(!data?.logs?.length) && <p className="text-xs py-4" style={{ color: 'var(--text-muted)' }}>No activity yet. Add a website and run a scan.</p>}
          </div>
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Status Distribution</h2>
          <div className="space-y-3">
            <BarRow label="Websites" value={data?.totalSites || 0} max={Math.max(data?.totalSites || 1, 1)} color="#3b82f6" />
            <BarRow label="Offers" value={data?.totalOffers || 0} max={Math.max(data?.totalOffers || 1, 1)} color="#22c55e" />
            <BarRow label="Scan Jobs" value={data?.totalJobs || 0} max={Math.max(data?.totalJobs || 1, 1)} color="#a855f7" />
            <BarRow label="Success Rate" value={successRate} max={100} color={successRate >= 60 ? '#22c55e' : '#f59e0b'} suffix="%" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  );
}

function BarRow({ label, value, max, color, suffix = '' }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
        <span>{label}</span>
        <span>{value}{suffix}</span>
      </div>
      <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
