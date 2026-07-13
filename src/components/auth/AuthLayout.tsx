'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Logo } from '@/components/Logo';

const pageConfig: Record<string, { title: string; desc: string }> = {
  '/auth/login': {
    title: 'Welcome back',
    desc: 'Sign in to discover verified promo codes.',
  },
  '/auth/register': {
    title: 'Join CodeXhange',
    desc: 'Create an account and start earning Fuel rewards.',
  },
  '/auth/forgot-password': {
    title: 'Reset your password',
    desc: 'Enter your email and we will send you a code to reset it.',
  },
  '/auth/reset-password': {
    title: 'Set new password',
    desc: 'Choose a strong password for your account.',
  },
};

export function AuthLayout({ children }: { children: ReactNode }) {
  const rawPathname = usePathname();
  const pathname = rawPathname ?? '';
  const config = pageConfig[pathname] ?? { title: '', desc: '' };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#d9770608_0%,transparent_60%)]" />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <Logo href="/" className="mb-6 text-2xl" />

      <div className="auth-card relative">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{config.title}</h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{config.desc}</p>
        </div>
        {children}
      </div>

      <div className="mt-6 flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Link href="/docs#terms-of-service" className="transition-colors hover:text-[--text-primary]">Terms</Link>
        <Link href="/docs#privacy-policy" className="transition-colors hover:text-[--text-primary]">Privacy</Link>
        <span>&copy; {new Date().getFullYear()} CodeXhange</span>
      </div>
    </div>
  );
}
