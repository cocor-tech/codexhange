import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import { Navbar } from '@/components/Navbar';
import { PageviewTracker } from '@/components/PageviewTracker';
import Link from 'next/link';
import { connectDB } from '@/lib/mongoose';
import Offer from '@/lib/models/Offer';
import Category from '@/lib/models/Category';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  icons: [{ rel: 'icon', url: '/favicon.svg', type: 'image/svg+xml' }],
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

async function getFooterBrands() {
  try {
    await connectDB();
    const brands = await Offer.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$store_name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]);
    return brands.map(b => ({
      name: b._id,
      slug: b._id.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, ''),
    }));
  } catch { return []; }
}

async function getFooterCategories() {
  try {
    await connectDB();
    const cats = await Category.find({ active: true }).sort({ name: 1 }).limit(6).lean();
    return cats.map((c: any) => ({ name: c.name, slug: c.slug }));
  } catch { return []; }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [popularBrands, categories] = await Promise.all([
    getFooterBrands(),
    getFooterCategories(),
  ]);

  const currentYear = new Date().getFullYear();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} font-sans antialiased flex min-h-screen flex-col`}>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('codexhange-theme');document.documentElement.className=t||'light'}catch(e){}})()`
        }} />
          <ToastProvider>
          <PageviewTracker />
          <Navbar />
          <div className="flex-1">{children}</div>
          <footer className="border-t py-10 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <div className="mx-auto max-w-5xl px-6">
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-center sm:text-left">
                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Popular Brands</h4>
                  <ul className="space-y-1.5">
                    {popularBrands.map((b) => (
                      <li key={b.slug}>
                        <Link href={`/brand/${b.slug}`} className="hover:text-[--text-primary] transition-colors">{b.name} Promo Codes</Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Categories</h4>
                  <ul className="space-y-1.5">
                    {categories.map((c) => (
                      <li key={c.slug}>
                        <Link href={`/category/${c.slug}`} className="hover:text-[--text-primary] transition-colors">{c.name}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>The Platform</h4>
                  <ul className="space-y-1.5">
                    <li><Link href="/about" className="hover:text-[--text-primary] transition-colors">About CodeXhange</Link></li>
                    <li><Link href="/contact" className="hover:text-[--text-primary] transition-colors">Contact Us</Link></li>
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
          </ToastProvider>
      </body>
    </html>
  );
}
