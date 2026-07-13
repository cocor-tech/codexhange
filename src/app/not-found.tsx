import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <h1 className="text-6xl font-extrabold" style={{ color: '#f59e0b' }}>404</h1>
      <p className="mt-4 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        Page not found
      </p>
      <p className="mt-2 max-w-md text-sm" style={{ color: 'var(--text-secondary)' }}>
        This page may have been removed or the link you followed might be broken. 
        Try browsing active promo codes instead.
      </p>
      <div className="mt-8 flex gap-4">
        <Link href="/" className="btn-primary px-5 py-2.5 text-sm">
          Go Home
        </Link>
        <Link href="/brand/nordvpn" className="btn-glass px-5 py-2.5 text-sm">
          Browse Codes
        </Link>
      </div>
    </div>
  );
}
