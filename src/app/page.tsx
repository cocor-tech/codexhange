import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { SearchBar } from '@/components/landing/SearchBar';
import { TrendingGrid } from '@/components/landing/TrendingGrid';
import { HotDealsStrip } from '@/components/landing/HotDealsStrip';
import { DustbinCounter } from '@/components/landing/DustbinCounter';
import { LiveActivityFeed } from '@/components/landing/LiveActivityFeed';
import { RegionSelector } from '@/components/landing/RegionSelector';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';

export const revalidate = 300;

async function getTrendingBrands() {
  try {
    await connectDB();
    const brands = await Code.aggregate([
      { $match: { archived: false } },
      {
        $group: {
          _id: { slug: '$brandSlug', name: '$brand' },
          activeCodes: { $sum: 1 },
          totalUpvotes: { $sum: '$upvotes' },
          totalDownvotes: { $sum: '$downvotes' },
          totalClicks: { $sum: '$clicks' },
        },
      },
      {
        $project: {
          _id: 0,
          slug: '$_id.slug',
          name: '$_id.name',
          activeCodes: 1,
          totalClicks: 1,
          successRate: {
            $cond: [
              { $gt: [{ $add: ['$totalUpvotes', '$totalDownvotes'] }, 0] },
              { $multiply: [{ $divide: ['$totalUpvotes', { $add: ['$totalUpvotes', '$totalDownvotes'] }] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { activeCodes: -1, totalClicks: -1 } },
      { $limit: 12 },
    ]);
    return brands;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const trendingBrands = await getTrendingBrands();

  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'CodeXhange',
    url: 'https://codexhange.com',
    description: 'Community-driven promo code library. Find verified discount codes and deals.',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />

      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,#d9770608_0%,transparent_60%)]" />

        {/* ── HEADER: Logo / Region / Auth ── */}
        <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo href="/" className="text-base" />
          <div className="flex items-center gap-2 sm:gap-3">
            <RegionSelector />
            <ThemeToggle />
            <Link href="/auth/login" className="btn-glass px-3 py-1.5 text-xs sm:text-sm">Sign in</Link>
          </div>
        </header>

        {/* ── HERO: Heading + Search Bar ── */}
        <section className="relative z-10 mx-auto max-w-5xl px-6 pt-10 pb-8 text-center sm:pt-16">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl" style={{ color: 'var(--text-primary)' }}>
            Find Active Promo Codes &amp; Discounts
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
            Community-verified discount codes. No expired deals. No login required.
          </p>
          <div className="mt-6">
            <SearchBar />
          </div>
        </section>

        {/* ── HOT DEALS STRIP ── */}
        <HotDealsStrip />

        {/* ── DUSTBIN COUNTER ── */}
        <DustbinCounter />

        {/* ── TRENDING STORES GRID ── */}
        <section className="relative z-10 mx-auto max-w-5xl px-6 pb-16">
          <TrendingGrid initial={trendingBrands} />
        </section>

        {/* ── HOW IT WORKS + LIVE FEED (side by side) ── */}
        <section className="relative z-10 mx-auto max-w-5xl px-6 pb-16">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* How It Works — 2/3 */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                How CodeXhange Works
              </h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Find verified codes in seconds. Post your own and earn affiliate commissions.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="glass-card">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold" style={{ backgroundColor: '#d9770620', color: '#f59e0b' }}>1</div>
                  <h3 className="mt-3 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Search or Browse</h3>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Find any brand and copy active promo codes instantly. No account needed.
                  </p>
                </div>
                <div className="glass-card">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold" style={{ backgroundColor: '#d9770620', color: '#f59e0b' }}>2</div>
                  <h3 className="mt-3 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Submit Your Codes</h3>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Post discount codes with your affiliate link. Earn real commissions when people use them.
                  </p>
                </div>
                <div className="glass-card">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold" style={{ backgroundColor: '#d9770620', color: '#f59e0b' }}>3</div>
                  <h3 className="mt-3 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Vote &amp; Trust</h3>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Community votes keep expired codes buried. Verified codes rise to the top.
                  </p>
                </div>
              </div>
              <div className="mt-6 text-center">
                <Link href="/auth/login" className="btn-primary px-5 py-2.5 text-sm">
                  Start Contributing
                </Link>
              </div>
            </div>

            {/* Live Feed — 1/3 */}
            <div>
              <LiveActivityFeed />
            </div>
          </div>
        </section>

        {/* ── WHY TRUST US ── */}
        <section className="relative z-10 mx-auto max-w-5xl px-6 pb-16">
          <h2 className="text-2xl font-bold text-center" style={{ color: 'var(--text-primary)' }}>
            Why Shoppers Trust CodeXhange
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div className="glass-card text-center">
              <p className="text-3xl font-extrabold" style={{ color: '#f59e0b' }}>100%</p>
              <h3 className="mt-2 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Community Verified</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Every code is rated by real shoppers. Expired codes auto-archive in the Dustbin.
              </p>
            </div>
            <div className="glass-card text-center">
              <p className="text-3xl font-extrabold" style={{ color: '#f59e0b' }}>0</p>
              <h3 className="mt-2 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>No Account Required</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Browse and copy any discount code instantly. No login or email needed.
              </p>
            </div>
            <div className="glass-card text-center">
              <p className="text-3xl font-extrabold" style={{ color: '#f59e0b' }}>50+</p>
              <h3 className="mt-2 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Brands &amp; Growing</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                From global SaaS to local delivery. New brands added daily by the community.
              </p>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="relative z-10 mx-auto max-w-3xl px-6 pb-20">
          <h2 className="text-2xl font-bold text-center" style={{ color: 'var(--text-primary)' }}>
            Frequently Asked Questions
          </h2>
          <div className="mt-8 space-y-3">
            {[
              { q: 'Do I need an account to use promo codes?', a: 'No. Browse, search, and copy any code without an account. Login is only needed to submit codes or vote.' },
              { q: 'How do you ensure codes are active?', a: 'Community voting system. Codes with 5+ downvotes and under 30% success rate auto-archive. The Dustbin keeps only accurate deals indexed.' },
              { q: 'Can I earn money by posting codes?', a: 'Yes. Attach your affiliate referral link when submitting a code. When shoppers use your link, you earn commissions from the merchant.' },
              { q: 'How does the community keep codes accurate?', a: 'Every code has upvote/downvote buttons. Expired codes get downvoted and auto-archive. Verified codes rise to the top.' },
              { q: 'Can I see codes for my country?', a: 'Yes. Use the region selector in the header or visit any brand page with ?country=XX to filter local deals.' },
            ].map((faq) => (
              <details key={faq.q} className="glass-card group open:pb-4">
                <summary className="cursor-pointer text-sm font-semibold list-none" style={{ color: 'var(--text-primary)' }}>
                  <span className="flex items-center justify-between gap-2">
                    {faq.q}
                    <svg className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
