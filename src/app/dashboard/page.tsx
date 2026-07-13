'use client';

import { useSession, signOut } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useState, useEffect } from 'react';
import { getDeviceFingerprint } from '@/lib/fingerprint';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [fuelData, setFuelData] = useState<any>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const fp = getDeviceFingerprint();
    fetch('/api/fuel', {
      headers: { 'X-Device-Fingerprint': fp },
    })
      .then((r) => r.ok ? r.json() : null)
      .then(setFuelData);
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--color-bg-base)' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <Logo href="/" />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {fuelData?.balance ?? 0} Fuel
          </span>
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
              Fuel Balance
            </p>
            <p className="mt-2 text-3xl font-bold" style={{ color: '#f59e0b' }}>
              {fuelData?.balance ?? 0}
            </p>
          </div>
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

        <div className="mt-10">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Recent Transactions
          </h2>
          {fuelData?.transactions?.length > 0 ? (
            <div className="mt-4 space-y-2">
              {fuelData.transactions.map((tx: any) => (
                <div key={tx._id} className="glass-card flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {tx.reason.charAt(0).toUpperCase() + tx.reason.slice(1)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${tx.type === 'earned' ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.type === 'earned' ? '+' : '-'}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
              No transactions yet. Start contributing to earn Fuel!
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
