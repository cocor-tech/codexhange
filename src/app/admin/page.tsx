'use client';

import { useState, useEffect } from 'react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

type Tab = 'overview' | 'categories' | 'brands' | 'services' | 'offers' | 'pending' | 'users' | 'logs';

type SessionState = {
  authenticated: boolean;
  email?: string;
  loading: boolean;
  locked?: boolean;
};

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [actionMsg, setActionMsg] = useState('');
  const [session, setSession] = useState<SessionState>({ authenticated: false, loading: true });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Record<string,string>>({});
  const [otpCooldown, setOtpCooldown] = useState(0);

  const msg = (s: string) => { setActionMsg(s); setTimeout(() => setActionMsg(''), 4000); };
  const clearMsg = () => setActionMsg('');

  const checkSession = async () => {
    const token = window.localStorage.getItem('admin_token');
    if (!token) {
      setSession({ authenticated: false, loading: false });
      return;
    }

    const res = await window.fetch('/api/admin/session', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setSession({ authenticated: data.authenticated, email: data.email, loading: false, locked: data.locked });
      if (data.locked) window.localStorage.removeItem('admin_token');
      if (!data.authenticated && !data.locked) window.localStorage.removeItem('admin_token');
    } else {
      setSession({ authenticated: false, loading: false });
      window.localStorage.removeItem('admin_token');
    }
  };

  const fetchStats = async () => {
    const res = await window.fetch('/api/admin/stats');
    if (res.ok) {
      const data = await res.json();
      setStats({ pendingReview: String(data.pendingReview ?? '—'), totalBrands: String(data.totalBrands ?? '—'), totalOffers: String(data.totalOffers ?? '—'), totalUsers: String(data.totalUsers ?? '—') });
    }
  };

  useEffect(() => { checkSession(); }, []);

  useEffect(() => { if (session.authenticated) fetchStats(); }, [session.authenticated]);

  const loginWithPassword = async () => {
    if (session.locked) return;
    setBusy(true);
    setError('');
    try {
      const res = await window.fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, action: 'login' }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = { error: 'Server error — empty response' }; }
      setBusy(false);
      if (!res.ok) {
        setError(data.error || 'Invalid credentials');
        if (data.locked) {
          setSession({ ...session, authenticated: false, locked: true });
          setPassword('');
        }
        return;
      }
      setPassword('');
      if (data.requiresOtp) {
        setOtpRequired(true);
        msg('Verification code sent');
        if (data.devCode) console.info('Admin OTP dev code:', data.devCode);
        return;
      }
      window.localStorage.setItem('admin_token', data.token);
      setSession({ authenticated: true, email, loading: false });
      msg('Signed in');
    } catch (err) {
      setBusy(false);
      setError('Network error — could not reach server');
    }
  };

  const resendOtp = async () => {
    if (session.locked || otpCooldown > 0) return;
    setError('');
    const res = await window.fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, action: 'send' }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Could not resend code');
      return;
    }
    if (data.devCode) console.info('Admin OTP dev code:', data.devCode);
    setOtpCooldown(30);
    const interval = setInterval(() => setOtpCooldown(prev => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; }), 1000);
    msg('Verification code resent');
  };

  const verifyOtp = async () => {
    if (session.locked) return;
    setBusy(true);
    setError('');
    try {
      const res = await window.fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, action: 'verify' }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = { error: 'Server error — empty response' }; }
      setBusy(false);
      if (!res.ok) {
        setError(data.error || 'Invalid code');
        return;
      }
      window.localStorage.setItem('admin_token', data.token);
      setSession({ authenticated: true, email, loading: false });
      setOtpRequired(false);
      setOtp('');
      msg('Signed in');
    } catch (err) {
      setBusy(false);
      setError('Network error — could not reach server');
    }
  };

  const changePassword = async () => {
    setBusy(true);
    setError('');
    const token = window.localStorage.getItem('admin_token');
    const res = await window.fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
      body: JSON.stringify({ email: session.email, password: currentPassword, newPassword, action: 'change-password' }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || 'Could not update password');
      return;
    }
    setNewPassword('');
    setCurrentPassword('');
    msg('Password updated');
  };

  const logout = async () => {
    const token = window.localStorage.getItem('admin_token');
    if (token) {
      await window.fetch('/api/admin/session', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    }
    window.localStorage.removeItem('admin_token');
    setSession({ authenticated: false, loading: false });
    setEmail('');
    setPassword('');
    setOtp('');
    setOtpRequired(false);
  };

  if (session.loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-base)' }}><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading admin access…</p></div>;
  }

  if (!session.authenticated) {
    if (session.locked) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center" style={{ backgroundColor: 'var(--color-bg-base)' }}>
          <h1 className="text-6xl font-extrabold" style={{ color: '#f59e0b' }}>404</h1>
          <p className="mt-4 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Access unavailable</p>
          <p className="mt-2 max-w-md text-sm" style={{ color: 'var(--text-secondary)' }}>
            This sign-in attempt has been blocked after repeated failed tries. Please wait and try again later.
          </p>
          <div className="mt-8">
            <button onClick={() => window.location.assign('/')} className="btn-primary px-5 py-2.5 text-sm">Go Home</button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg-base)' }}>
        <div className="glass-card max-w-md w-full">
          <div className="flex items-center justify-between">
            <Logo href="/" className="text-base" />
            <ThemeToggle />
          </div>
          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.3em]" style={{ color: '#d97706' }}>Admin access</p>
            <h1 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Sign in with your email and password</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>Enter the admin email and password for this workspace.</p>
          </div>
          <div className="mt-6 space-y-3">
            <input disabled={session.locked} value={email} onChange={(e) => setEmail(e.target.value)} className="input-glass" placeholder="you@company.com" />
            {!otpRequired && <input disabled={session.locked} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-glass" placeholder="Password" />}
            {otpRequired && <input disabled={session.locked} value={otp} onChange={(e) => setOtp(e.target.value)} className="input-glass" placeholder="Enter verification code" />}
            {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}
            {otpRequired ? (
              <div className="flex gap-2">
                <button disabled={busy || !otp || session.locked} onClick={verifyOtp} className="btn-primary flex-1">{busy ? 'Verifying…' : 'Verify code'}</button>
                <button disabled={busy || otpCooldown > 0 || session.locked} onClick={resendOtp} className="btn-glass px-3 text-xs whitespace-nowrap">{otpCooldown > 0 ? `${otpCooldown}s` : 'Resend'}</button>
              </div>
            ) : (
              <button disabled={busy || !email || !password || session.locked} onClick={loginWithPassword} className="btn-primary w-full">{busy ? 'Signing in…' : 'Sign in'}</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <main className="mx-auto max-w-7xl px-6 pb-32 pt-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em]" style={{ color: '#d97706' }}>Offer Intelligence Platform</p>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{session.email}</span>
            <button onClick={logout} className="rounded-md px-3 py-1.5 text-xs font-medium border hover:bg-red-500/10" style={{ borderColor: 'var(--border)', color: '#ef4444' }}>Logout</button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <a href="/admin/websites" className="glass-card p-5 hover:opacity-80 transition-opacity block">
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Websites</p>
            <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>0</div>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Manage your sources</p>
          </a>
          <a href="/admin/offers" className="glass-card p-5 hover:opacity-80 transition-opacity block">
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Offers</p>
            <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.totalOffers || '0'}</div>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>All discovered deals</p>
          </a>
          <a href="/admin/review" className="glass-card p-5 hover:opacity-80 transition-opacity block">
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Review Queue</p>
            <div className="mt-2 text-2xl font-bold" style={{ color: '#f59e0b' }}>{stats.pendingReview || '0'}</div>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Pending approval</p>
          </a>
          <a href="/admin/scanner" className="glass-card p-5 hover:opacity-80 transition-opacity block">
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Deal Scanner</p>
            <div className="mt-2 text-2xl font-bold" style={{ color: '#22c55e' }}>🔍</div>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Scan any URL instantly</p>
          </a>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <NavCard href="/admin/websites" title="Websites" desc="Add, manage, and scan websites. This is where your sources live." color="#3b82f6" />
          <NavCard href="/admin/offers" title="Offers" desc="Browse all discovered promo codes, sales, and free trials." color="#22c55e" />
          <NavCard href="/admin/review" title="Review Queue" desc="Approve or reject pending offers before they go live." color="#f59e0b" />
          <NavCard href="/admin/scan-jobs" title="Scan Jobs" desc="Track individual page scans and their status." color="#a855f7" />
          <NavCard href="/admin/scanner" title="Deal Scanner" desc="Paste any URL and extract promo codes instantly." color="#8b5cf6" />
          <NavCard href="/admin/analytics" title="Analytics" desc="Charts, metrics, and performance trends." color="#ec4899" />
          <NavCard href="/admin/logs" title="Logs" desc="View bot scan history, errors, and activity." color="#6b7280" />
          <NavCard href="/admin/settings" title="Settings" desc="Bot configuration, AI provider, publishing rules." color="#ec4899" />
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Recent Activity</h2>
          <div className="space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <p>Add a website to get started. Go to <a href="/admin/websites" className="underline" style={{ color: '#3b82f6' }}>Websites</a> to add your first source.</p>
          </div>
        </div>

        <div className="mt-6 glass-card p-5">
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Offer Intelligence Platform</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Version 2.0 — Built with Python async scraper, Next.js admin panel, and MongoDB.
            <a href="https://github.com/oraimoitel/codexhange" target="_blank" className="ml-2 underline" style={{ color: '#3b82f6' }}>GitHub</a>
          </p>
        </div>

        <div className="mt-6 glass-card p-5">
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Change admin password</h2>
          <div className="flex flex-col gap-2 max-w-xs">
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input-glass px-3 py-2 text-sm" placeholder="Current password" />
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-glass px-3 py-2 text-sm" placeholder="New password" />
            <button disabled={busy || !newPassword || !currentPassword} onClick={changePassword} className="btn-glass px-3 py-2 text-xs self-start">{busy ? 'Updating…' : 'Update password'}</button>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavCard({ href, title, desc, color }: { href: string; title: string; desc: string; color: string }) {
  return (
    <a href={href} className="glass-card p-5 hover:opacity-80 transition-opacity block">
      <h3 className="text-sm font-bold" style={{ color }}>{title}</h3>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
    </a>
  );
}


