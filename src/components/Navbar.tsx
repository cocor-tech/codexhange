'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Logo } from '@/components/Logo';

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname() ?? '';

  if (pathname.startsWith('/auth/')) return null;
  if (pathname === '/') return null;

  const isAdmin = (session?.user as any)?.isAdmin ?? false;

  return (
    <nav className="flex w-full items-center justify-between px-4 sm:px-6 py-4 max-w-6xl mx-auto">
      <Logo href="/" className="text-sm sm:text-base" />
      <div className="flex items-center gap-1.5 sm:gap-3">
        <ThemeToggle />
        {session ? (
          <>
            {isAdmin && (
              <Link href="/admin" className="btn-glass px-2 py-1 text-xs" style={{ color: '#ef4444' }}>
                Admin
              </Link>
            )}
            <Link href="/dashboard" className="btn-glass px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm">
              Dashboard
            </Link>
          </>
        ) : (
          <Link href="/auth/login" className="btn-glass px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
