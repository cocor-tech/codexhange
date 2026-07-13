import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { SessionProvider } from '@/lib/SessionProvider';
import { Navbar } from '@/components/Navbar';
import Link from 'next/link';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: {
    default: 'CodeXhange — Active Promo Codes & Discounts | Community Verified',
    template: '%s | CodeXhange',
  },
  description: 'Find working promo codes and discount codes verified by real shoppers. Community-rated deals for thousands of brands. No login required to browse.',
  keywords: ['promo codes', 'discount codes', 'coupon codes', 'deals', 'savings', 'community verified'],
  openGraph: {
    title: 'CodeXhange — Find Active Promo Codes & Discounts',
    description: 'Community-verified discount codes. No expired deals. No login required.',
    url: 'https://codexhange.com',
    siteName: 'CodeXhange',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CodeXhange — Active Promo Codes',
    description: 'Working promo codes verified by the community.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

const currentYear = new Date().getFullYear();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} font-sans antialiased flex min-h-screen flex-col`}>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('codexhange-theme');document.documentElement.className=t||'light'}catch(e){}})()`
        }} />
        <SessionProvider>
          <Navbar />
          <div className="flex-1">{children}</div>
          <footer className="border-t py-10 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <div className="mx-auto max-w-5xl px-6">
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-center sm:text-left">
                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Popular Brands</h4>
                  <ul className="space-y-1.5">
                    {[
                      { label: 'NordVPN', href: '/brand/nordvpn' },
                      { label: 'Uber', href: '/brand/uber' },
                      { label: 'DoorDash', href: '/brand/doordash' },
                      { label: 'Spotify', href: '/brand/spotify' },
                      { label: 'Nike', href: '/brand/nike' },
                      { label: 'Amazon', href: '/brand/amazon' },
                    ].map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="hover:text-[--text-primary] transition-colors">{link.label} Promo Codes</Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Categories</h4>
                  <ul className="space-y-1.5">
                    {[
                      { label: 'SaaS & Software', href: '/brand/nordvpn' },
                      { label: 'Food & Delivery', href: '/brand/uber' },
                      { label: 'Streaming', href: '/brand/spotify' },
                      { label: 'Fashion', href: '/brand/nike' },
                      { label: 'Travel', href: '/brand/uber' },
                      { label: 'Online Learning', href: '/brand/skillshare' },
                    ].map((link) => (
                      <li key={link.label}>
                        <Link href={link.href} className="hover:text-[--text-primary] transition-colors">{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>The Platform</h4>
                  <ul className="space-y-1.5">
                    <li><Link href="/about" className="hover:text-[--text-primary] transition-colors">About CodeXhange</Link></li>
                    <li><Link href="/contact" className="hover:text-[--text-primary] transition-colors">Contact Us</Link></li>
                    <li><Link href="/auth/register" className="hover:text-[--text-primary] transition-colors">Create Account</Link></li>
                    <li><Link href="/auth/login" className="hover:text-[--text-primary] transition-colors">Sign In</Link></li>
                  </ul>
                </div>
                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Legal</h4>
                  <ul className="space-y-1.5">
                    <li><Link href="/privacy" className="hover:text-[--text-primary] transition-colors">Privacy Policy</Link></li>
                    <li><Link href="/terms" className="hover:text-[--text-primary] transition-colors">Terms of Service</Link></li>
                    <li><Link href="/contact" className="hover:text-[--text-primary] transition-colors">Affiliate Disclosure</Link></li>
                  </ul>
                </div>
              </div>
              <div className="mt-8 border-t pt-6 text-center" style={{ borderColor: 'var(--border)' }}>
                <p>&copy; {currentYear} CodeXhange. Some links are affiliate links. We may earn a commission at no extra cost to you.</p>
              </div>
            </div>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
