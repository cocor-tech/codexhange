'use client';

import { useState, useEffect } from 'react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import Link from 'next/link';

type SessionState = {
  authenticated: boolean;
  email?: string;
  loading: boolean;
  locked?: boolean;
};

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '◉', desc: 'Overview & stats' },
  { href: '/admin/websites', label: 'Websites', icon: '◐', desc: 'Manage sources' },
  { href: '/admin/offers', label: 'Offers', icon: '◎', desc: 'All discovered deals' },
  { href: '/admin/review', label: 'Review Queue', icon: '◈', desc: 'Pending approval' },
  { href: '/admin/scanner', label: 'Deal Scanner', icon: '◉', desc: 'Scan any URL' },
  { href: '/admin/scan-jobs', label: 'Scan Jobs', icon: '◌', desc: 'Track scans' },
  { href: '/admin/analytics', label: 'Analytics', icon: '◉', desc: 'Charts & metrics' },
  { href: '/admin/logs', label: 'Logs', icon: '◒', desc: 'Bot activity' },
  { href: '/admin/settings', label: 'Settings', icon: '◓', desc: 'Configuration' },
];

export default function AdminPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [session, setSession] = useState<SessionState>({ authenticated: false, loading: true });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Record<string, string>>({});
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [actionMsg, setActionMsg] = useState('');
  const [scanProgress, setScanProgress] = useState<any>(null);

  const msg = (s: string) => { setActionMsg(s); setTimeout(() => setActionMsg(''), 4000); };

  const checkSession = async () => {
    const token = window.localStorage.getItem('admin_token');
    if (!token) { setSession({ authenticated: false, loading: false }); return; }
    const res = await window.fetch('/api/admin/session', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setSession({ authenticated: data.authenticated, email: data.email, loading: false, locked: data.locked });
      if (data.locked || !data.authenticated) window.localStorage.removeItem('admin_token');
    } else {
      setSession({ authenticated: false, loading: false });
      window.localStorage.removeItem('admin_token');
    }
  };

  const fetchStats = async () => {
    const res = await window.fetch('/api/admin/stats');
    if (res.ok) {
      const d = await res.json();
      setStats({
        pendingReview: String(d.pendingReview ?? '—'),
        totalBrands: String(d.totalBrands ?? '—'),
        totalOffers: String(d.totalOffers ?? '—'),
        totalUsers: String(d.totalUsers ?? '—'),
        totalWebsites: String(d.totalWebsites ?? '0'),
        totalCategories: String(d.totalCategories ?? '0'),
        totalCodes: String(d.totalCodes ?? '0'),
        publishedOffers: String(d.publishedOffers ?? '0'),
        blockedSites: String(d.blockedSites ?? '0'),
        totalClicks: String(d.totalClicks ?? '0'),
        totalUpvotes: String(d.totalUpvotes ?? '0'),
        totalDownvotes: String(d.totalDownvotes ?? '0'),
        uniquePageviews: String(d.uniquePageviews ?? '0'),
      });
    }
  };

  useEffect(() => { checkSession(); }, []);
  useEffect(() => { if (session.authenticated) { fetchStats(); } }, [session.authenticated]);

  useEffect(() => {
    if (!session.authenticated) return;
    const fetchProgress = async () => {
      const res = await window.fetch('/api/admin/scan-progress');
      if (res.ok) setScanProgress(await res.json());
    };
    fetchProgress();
    const interval = setInterval(fetchProgress, 5000);
    return () => clearInterval(interval);
  }, [session.authenticated]);

  const loginWithPassword = async () => {
    if (session.locked) return;
    setBusy(true); setError('');
    try {
      const res = await window.fetch('/api/admin/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, action: 'login' }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { setError(data.error || 'Invalid credentials'); if (data.locked) setSession({ ...session, locked: true }); return; }
      setPassword('');
      if (data.requiresOtp) { setOtpRequired(true); msg('OTP sent'); return; }
      window.localStorage.setItem('admin_token', data.token);
      setSession({ authenticated: true, email, loading: false });
    } catch { setBusy(false); setError('Network error'); }
  };

  const verifyOtp = async () => {
    setBusy(true); setError('');
    const res = await window.fetch('/api/admin/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, action: 'verify' }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Invalid code'); return; }
    window.localStorage.setItem('admin_token', data.token);
    setSession({ authenticated: true, email, loading: false });
    setOtpRequired(false); setOtp('');
  };

  const resendOtp = async () => {
    if (session.locked || otpCooldown > 0) return;
    const res = await window.fetch('/api/admin/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, action: 'send' }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Could not resend'); return; }
    setOtpCooldown(30);
    const interval = setInterval(() => setOtpCooldown(p => { if (p <= 1) { clearInterval(interval); return 0; } return p - 1; }), 1000);
    msg('OTP resent');
  };

  const logout = async () => {
    const token = window.localStorage.getItem('admin_token');
    if (token) await window.fetch('/api/admin/session', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    window.localStorage.removeItem('admin_token');
    setSession({ authenticated: false, loading: false });
    setEmail(''); setPassword(''); setOtp(''); setOtpRequired(false);
  };

  if (session.loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
    </div>;
  }

  if (!session.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg-base)' }}>
        <div className="glass-card max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-6">
            <Logo href="/" className="text-base" />
            <ThemeToggle />
          </div>
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: '#d97706' }}>Admin access</p>
          <h1 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Sign in</h1>
          <div className="mt-6 space-y-3">
            <input value={email} onChange={e => setEmail(e.target.value)} className="input-glass w-full" placeholder="admin@codexhange.com" />
            {!otpRequired && <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-glass w-full" placeholder="Password" />}
            {otpRequired && <input value={otp} onChange={e => setOtp(e.target.value)} className="input-glass w-full" placeholder="OTP code" />}
            {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}
            {otpRequired ? (
              <div className="flex gap-2">
                <button disabled={busy || !otp} onClick={verifyOtp} className="btn-primary flex-1">{busy ? '…' : 'Verify'}</button>
                <button disabled={busy || otpCooldown > 0} onClick={resendOtp} className="btn-glass px-3 text-xs">{otpCooldown > 0 ? `${otpCooldown}s` : 'Resend'}</button>
              </div>
            ) : (
              <button disabled={busy || !email || !password} onClick={loginWithPassword} className="btn-primary w-full">{busy ? '…' : 'Sign in'}</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 border-r`} style={{ backgroundColor: 'var(--color-bg-base)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <Logo href="/admin" className="text-sm" />
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>
        <nav className="p-3 space-y-1">
          {NAV.map(n => (
            <Link key={n.href} href={n.href} onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--hover-overlay)]"
              style={{ color: 'var(--text-secondary)' }}>
              <span className="w-5 text-center text-xs opacity-60">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={logout} className="flex items-center gap-2 text-xs" style={{ color: '#ef4444' }}>
            Logout {session.email}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b lg:hidden" style={{ borderColor: 'var(--border)' }}>
          <button onClick={() => setSidebarOpen(true)} className="text-sm" style={{ color: 'var(--text-primary)' }}>☰</button>
          <Logo href="/admin" className="text-sm" />
          <ThemeToggle />
        </header>

        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em]" style={{ color: '#d97706' }}>Offer Intelligence</p>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
            </div>
            <ThemeToggle />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Websites" value={stats.totalWebsites || '0'} sub="Active sources" color="#3b82f6" />
            <StatCard label="Offers" value={stats.totalOffers || '0'} sub="Total discovered" color="#22c55e" />
            <StatCard label="Published" value={stats.publishedOffers || '0'} sub="Live on site" color="#22c55e" />
            <StatCard label="Pending Review" value={stats.pendingReview || '0'} sub="Needs approval" color="#f59e0b" />
            <StatCard label="Brands" value={stats.totalBrands || '0'} sub="In database" color="#a855f7" />
            <StatCard label="Categories" value={stats.totalCategories || '0'} sub="Organized" color="#ec4899" />
            <StatCard label="User Codes" value={stats.totalCodes || '0'} sub="Submitted" color="#3b82f6" />
            <StatCard label="Blocked Sites" value={stats.blockedSites || '0'} sub="Cloudflare etc" color="#ef4444" />
            <StatCard label="Clicks" value={stats.totalClicks || '0'} sub="On offers" color="#f59e0b" />
            <StatCard label="Upvotes" value={stats.totalUpvotes || '0'} sub="Positive feedback" color="#22c55e" />
            <StatCard label="Downvotes" value={stats.totalDownvotes || '0'} sub="Negative feedback" color="#ef4444" />
            <StatCard label="Pageviews" value={stats.uniquePageviews || '0'} sub="Unique today" color="#3b82f6" />
            <StatCard label="Users" value={stats.totalUsers || '0'} sub="Admin accounts" color="#6b7280" />
          </div>

          {/* Scan progress */}
          {scanProgress && scanProgress.status !== 'idle' && scanProgress.total > 0 && (
            <div className="glass-card p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Full Scan
                  </h3>
                  <span className={`text-xs font-medium ${
                    scanProgress.status === 'running' ? 'text-green-500' :
                    scanProgress.status === 'paused' ? 'text-yellow-500' :
                    scanProgress.status === 'complete' ? 'text-blue-500' : 'text-gray-500'
                  }`}>
                    ● {scanProgress.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {scanProgress.status === 'running' && (
                    <button onClick={async () => {
                      await window.fetch('/api/admin/scan-progress', {
                        method: 'POST', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ action: 'pause' })
                      });
                    }} className="btn-glass px-3 py-1 text-xs">Pause</button>
                  )}
                  {scanProgress.status === 'paused' && (
                    <button onClick={async () => {
                      await window.fetch('/api/admin/scan-progress', {
                        method: 'POST', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ action: 'continue' })
                      });
                    }} className="btn-glass px-3 py-1 text-xs">Continue</button>
                  )}
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {scanProgress.offers} offers · ETA: {scanProgress.eta_min || '?'}min
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="h-full rounded-full transition-all duration-1000" style={{
                  width: `${Math.min((scanProgress.done / scanProgress.total) * 100, 100)}%`,
                  backgroundColor: scanProgress.status === 'complete' ? '#3b82f6' : '#22c55e'
                }} />
              </div>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {scanProgress.done.toLocaleString()} / {scanProgress.total.toLocaleString()} stores
                {scanProgress.done > 0 && ` (${Math.round((scanProgress.done / scanProgress.total) * 100)}%)`}
              </p>
            </div>
          )}

          {/* Nav cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {NAV.filter(n => n.href !== '/admin').map(n => (
              <div key={n.href} className="glass-card p-4 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs opacity-60 mb-1">{n.icon}</p>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{n.label}</h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{n.desc || 'Manage'}</p>
                </div>
                <Link href={n.href}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--hover-overlay)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  <span className="text-sm">→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="glass-card p-4">
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  );
}
