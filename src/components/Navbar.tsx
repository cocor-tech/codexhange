'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Logo } from '@/components/Logo';

export function Navbar() {
  const pathname = usePathname() ?? '';

  if (pathname === '/') return null;

  return (
    <nav className="flex w-full items-center justify-between px-4 sm:px-6 py-4 max-w-6xl mx-auto">
      <Logo href="/" className="text-sm sm:text-base" />
      <div className="flex items-center gap-1.5 sm:gap-3">
        <ThemeToggle />
        <Link href="/admin" className="btn-glass px-2 py-1 text-xs" style={{ color: '#ef4444' }}>
          Admin
        </Link>
      </div>
    </nav>
  );
}
