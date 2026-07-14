'use client';

import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = '/auth/login';
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--color-bg-base)' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <Logo href="/" />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button onClick={() => signOut()} variant="glass" className="text-sm">
            Sign Out
          </Button>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 pb-32">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Welcome, {session?.user?.name || session?.user?.email}
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <div className="glass-card">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Codes Submitted
            </p>
            <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              --
            </p>
          </div>
          <div className="glass-card">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Votes Cast
            </p>
            <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              --
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
