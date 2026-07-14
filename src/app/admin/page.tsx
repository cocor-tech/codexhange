'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

type Tab = 'codes' | 'users' | 'stats';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>('codes');
  const [codes, setCodes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [totalCodes, setTotalCodes] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [codePage, setCodePage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [codeSearch, setCodeSearch] = useState('');
  const [codeStatus, setCodeStatus] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const fetchCodes = async (p: number, s: string, st: string) => {
    const params = new URLSearchParams({ page: String(p), limit: '50' });
    if (s) params.set('search', s);
    if (st) params.set('status', st);
    const res = await fetch(`/api/admin/codes?${params}`);
    if (res.ok) {
      const data = await res.json();
      setCodes(data.codes);
      setTotalCodes(data.total);
      setCodePage(data.page);
    }
  };

  const fetchUsers = async (p: number) => {
    const res = await fetch(`/api/admin/users?page=${p}&limit=50`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
      setTotalUsers(data.total);
      setUserPage(data.page);
    }
  };

  useEffect(() => {
    if (tab === 'codes') fetchCodes(codePage, codeSearch, codeStatus);
  }, [tab, codePage]);

  useEffect(() => {
    if (tab === 'users') fetchUsers(userPage);
  }, [tab, userPage]);

  const handleCodeAction = async (codeId: string, action: string) => {
    const res = await fetch('/api/admin/codes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeId, action }),
    });
    if (res.ok) {
      setActionMsg(`${action} success`);
      fetchCodes(codePage, codeSearch, codeStatus);
    } else {
      const data = await res.json();
      setActionMsg(data.error || 'Action failed');
    }
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleDeleteCode = async (codeId: string) => {
    if (!confirm('Delete this code permanently?')) return;
    const res = await fetch('/api/admin/codes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeId }),
    });
    if (res.ok) {
      setActionMsg('Code deleted');
      fetchCodes(codePage, codeSearch, codeStatus);
    }
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleToggleAdmin = async (userId: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'toggle-admin' }),
    });
    if (res.ok) {
      setActionMsg('Admin toggled');
      fetchUsers(userPage);
    }
    setTimeout(() => setActionMsg(''), 3000);
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--color-bg-base)' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = '/auth/login';
    }
  }, [status]);

  if (status === 'unauthenticated') return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Logo href="/" className="text-base" />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-xs rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: '#ef444420', color: '#ef4444' }}>
            Admin
          </span>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 pb-32">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin</h1>

        {/* Tabs */}
        <div className="mt-4 flex gap-1 rounded-xl p-1 border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
          {(['codes', 'users', 'stats'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-4 py-2 text-xs font-semibold capitalize transition-all ${
                tab === t ? 'bg-brand-500/20 text-brand-500' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t} {t === 'codes' && `(${totalCodes})`}
            </button>
          ))}
        </div>

        {actionMsg && (
          <div className="mt-3 rounded-lg px-4 py-2 text-xs" style={{ backgroundColor: '#22c55e15', color: '#22c55e' }}>
            {actionMsg}
          </div>
        )}

        {/* Codes Tab */}
        {tab === 'codes' && (
          <div className="mt-6">
            <div className="flex gap-2 mb-4">
              <input
                value={codeSearch}
                onChange={(e) => setCodeSearch(e.target.value)}
                placeholder="Search brand, slug, or code..."
                className="input-glass flex-1 px-3 py-2 text-xs"
                onKeyDown={(e) => e.key === 'Enter' && fetchCodes(1, codeSearch, codeStatus)}
              />
              <select
                value={codeStatus}
                onChange={(e) => { setCodeStatus(e.target.value); fetchCodes(1, codeSearch, e.target.value); }}
                className="input-glass px-3 py-2 text-xs"
                style={{ color: 'var(--text-primary)' }}
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="space-y-2">
              {codes.map((c: any) => (
                <div key={c._id} className="glass-card flex items-center justify-between py-2 px-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.brand}</span>
                      {c.archived && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>ARCHIVED</span>}
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {c.code} — {c.description} · {c.upvotes}↑ {c.downvotes}↓ · {c.clicks} clicks
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 ml-3">
                    {!c.archived && (
                      <button onClick={() => handleCodeAction(c._id, 'archive')} className="rounded-md px-2 py-1 text-[10px] font-medium border hover:bg-red-500/10" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                        Archive
                      </button>
                    )}
                    {c.archived && (
                      <button onClick={() => handleCodeAction(c._id, 'unarchive')} className="rounded-md px-2 py-1 text-[10px] font-medium border hover:bg-green-500/10" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                        Unarchive
                      </button>
                    )}

                    <button onClick={() => handleDeleteCode(c._id)} className="rounded-md px-2 py-1 text-[10px] font-medium border hover:bg-red-500/10" style={{ borderColor: 'var(--border)', color: '#ef4444' }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {codes.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No codes found</p>
              )}
            </div>

            <div className="mt-4 flex justify-center gap-2">
              <button disabled={codePage <= 1} onClick={() => setCodePage(codePage - 1)} className="btn-glass px-3 py-1 text-xs disabled:opacity-30">Prev</button>
              <span className="text-xs px-3 py-1" style={{ color: 'var(--text-muted)' }}>Page {codePage}</span>
              <button disabled={codePage * 50 >= totalCodes} onClick={() => setCodePage(codePage + 1)} className="btn-glass px-3 py-1 text-xs disabled:opacity-30">Next</button>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div className="mt-6">
            <div className="space-y-2">
              {users.map((u: any) => (
                <div key={u._id} className="glass-card flex items-center justify-between py-2 px-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{u.name || u.email}</span>
                      {u.isAdmin && <span className="text-[10px] rounded-full px-1.5 py-0.5 font-bold" style={{ backgroundColor: '#ef444420', color: '#ef4444' }}>ADMIN</span>}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {u.email} · {u.fingerprintHashes?.length || 0} device{u.fingerprintHashes?.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button onClick={() => handleToggleAdmin(u._id)} className="rounded-md px-3 py-1 text-xs font-medium border hover:bg-brand-500/10 shrink-0 ml-3" style={{ borderColor: 'var(--border)', color: u.isAdmin ? '#ef4444' : 'var(--text-muted)' }}>
                    {u.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-center gap-2">
              <button disabled={userPage <= 1} onClick={() => setUserPage(userPage - 1)} className="btn-glass px-3 py-1 text-xs disabled:opacity-30">Prev</button>
              <span className="text-xs px-3 py-1" style={{ color: 'var(--text-muted)' }}>Page {userPage}</span>
              <button disabled={userPage * 50 >= totalUsers} onClick={() => setUserPage(userPage + 1)} className="btn-glass px-3 py-1 text-xs disabled:opacity-30">Next</button>
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {tab === 'stats' && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="glass-card text-center py-8">
              <p className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{totalCodes}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Total Codes</p>
            </div>
            <div className="glass-card text-center py-8">
              <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalUsers}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Total Users</p>
            </div>
            <div className="glass-card text-center py-8">
              <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{users.length}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Total Users</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
