'use client';

import { useState, useEffect } from 'react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

type ScanResult = {
  url: string;
  success: boolean;
  status: number;
  source: string;
  blocked: boolean;
  blocked_reason: string;
  title: string;
  codes: string[];
  countries: string[];
  deal_type: string;
  discount: string;
  error: string;
  fetched_at: string;
};

export default function ScannerPage() {
  const [inputUrl, setInputUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');

  useEffect(() => {
    window.fetch('/api/admin/brands?limit=1000').then(r => r.ok && r.json()).then(d => {
      if (d?.brands) setBrands(d.brands.sort((a: any, b: any) => a.name?.localeCompare(b.name)));
    }).catch(() => {});
  }, []);

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const normalizeUrl = (u: string) => {
    if (!u.startsWith('http://') && !u.startsWith('https://')) return `https://${u}`;
    return u;
  };

  const scan = async (targetUrl?: string) => {
    let url = targetUrl || inputUrl.trim() || (selectedBrand ? brands.find(b => b._id === selectedBrand)?.website : '');
    if (!url) return;
    url = normalizeUrl(url);

    setScanning(true);
    setLogs([]);
    setResult(null);
    addLog(`Scanning: ${url}`);
    addLog(`Fetching page with fallbacks...`);

    try {
      const res = await window.fetch('/api/admin/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      setResult(data);
      addLog(`Status: ${data.status} | Source: ${data.source}`);
      if (data.blocked) addLog(`⚠ Blocked: ${data.blocked_reason}`);
      if (data.codes?.length) addLog(`✅ Codes found: ${data.codes.join(', ')}`);
      else if (data.success) addLog(`No promo codes found on this page`);
      if (!data.success) addLog(`❌ ${data.error}`);
    } catch (err: any) {
      addLog(`❌ Error: ${err.message}`);
    }
    setScanning(false);
  };

  const dealTypeColor = (t: string) => {
    if (t === 'code') return '#22c55e';
    if (t === 'free_trial') return '#3b82f6';
    if (t === 'student_discount') return '#a855f7';
    return '#f59e0b';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <a href="/admin" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Back to Dashboard</a>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Deal Scanner</h1>
          </div>
          <ThemeToggle />
        </div>

        {/* URL Input */}
        <div className="glass-card p-4 mb-4">
          <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-primary)' }}>Paste a website URL</label>
          <div className="flex gap-2">
            <input
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && scan()}
              placeholder="https://example.com/coupons"
              className="input-glass flex-1 px-3 py-2 text-sm"
              disabled={scanning}
            />
            <button onClick={() => scan()} disabled={scanning || !inputUrl.trim()} className="btn-primary px-4 py-2 text-sm whitespace-nowrap">
              {scanning ? 'Scanning…' : 'Scan'}
            </button>
          </div>
        </div>

        {/* Brand Picker */}
        <div className="glass-card p-4 mb-4">
          <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-primary)' }}>Or pick a brand from your database</label>
          <div className="flex gap-2">
            <select
              value={selectedBrand}
              onChange={e => { setSelectedBrand(e.target.value); setInputUrl(''); }}
              className="input-glass flex-1 px-3 py-2 text-sm"
              style={{ color: 'var(--text-primary)' }}
            >
              <option value="">— Select a brand —</option>
              {brands.map((b: any) => (
                <option key={b._id} value={b._id}>{b.name} — {b.website}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const brand = brands.find(b => b._id === selectedBrand);
                if (brand) scan(brand.website);
              }}
              disabled={scanning || !selectedBrand}
              className="btn-primary px-4 py-2 text-sm whitespace-nowrap"
            >
              {scanning ? 'Scanning…' : 'Scan Brand'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          {/* Logs */}
          <div className="glass-card p-4">
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Live Log</h2>
            <div className="h-80 overflow-y-auto space-y-1 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {logs.length === 0 && <p className="text-xs">Waiting for scan…</p>}
              {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>

          {/* Result */}
          <div className="glass-card p-4">
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Scan Result</h2>
            {!result && !scanning && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Paste a URL or select a brand above.</p>}
            {scanning && !result && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fetching and analyzing…</p>}
            {result && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                    result.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>{result.success ? 'Success' : 'Failed'}</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>HTTP {result.status}</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>via {result.source}</span>
                </div>

                {result.blocked && (
                  <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: '#f59e0b20', color: '#f59e0b' }}>
                    ⚠ Blocked by {result.blocked_reason}. Try visiting manually.
                  </div>
                )}

                {result.title && (
                  <div>
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Title</span>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{result.title}</p>
                  </div>
                )}

                {result.codes?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Promo Codes Found</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {result.codes.map((code, i) => (
                        <span key={i} className="px-2 py-1 rounded-lg text-sm font-mono font-bold" style={{ backgroundColor: '#22c55e20', color: '#22c55e' }}>
                          {code}
                          <button onClick={() => navigator.clipboard.writeText(code)} className="ml-2 text-[10px] opacity-60 hover:opacity-100" title="Copy">📋</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.deal_type && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Type</span>
                    <span className="text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: `${dealTypeColor(result.deal_type)}20`, color: dealTypeColor(result.deal_type) }}>
                      {result.deal_type}
                    </span>
                  </div>
                )}

                {result.discount && (
                  <div>
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Discount</span>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{result.discount}</p>
                  </div>
                )}

                {result.countries?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Region</span>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{result.countries.join(', ')}</p>
                  </div>
                )}

                {!result.success && result.error && (
                  <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: '#ef444415', color: '#ef4444' }}>
                    {result.error}
                  </div>
                )}

                <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-block rounded-md px-3 py-1.5 text-xs font-medium border hover:bg-blue-500/10" style={{ borderColor: 'var(--border)', color: '#3b82f6' }}>
                  Visit Page →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
