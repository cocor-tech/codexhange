import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { SearchBar } from '@/components/landing/SearchBar';
import { RegionSelector } from '@/components/landing/RegionSelector';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export const dynamic = 'force-dynamic';
import { connectDB } from '@/lib/mongoose';
import Brand from '@/lib/models/Brand';
import Offer from '@/lib/models/Offer';
import Category from '@/lib/models/Category';
import Website from '@/lib/models/Website';
import Code from '@/lib/models/Code';

export const revalidate = 300;

async function getTrendingOffers() {
  try {
    await connectDB();
    return Offer.find({ status: 'published' })
      .sort({ confidence: -1, updatedAt: -1 })
      .limit(6)
      .lean();
  } catch { return []; }
}

async function getCategories() {
  try {
    await connectDB();
    const cats = await Category.find({ active: true }).sort({ order: 1, name: 1 }).lean();
    return Promise.all(cats.map(async (c: any) => {
      const count = await Brand.countDocuments({ categories: c._id, active: true });
      return { name: c.name, slug: c.slug, brandCount: count };
    }));
  } catch { return []; }
}

async function getPopularBrands() {
  try {
    await connectDB();
    const brands = await Offer.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$store_name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]);
    // Randomize and pick 8
    const shuffled = brands.sort(() => Math.random() - 0.5).slice(0, 8);
    return shuffled.map(b => ({
      name: b._id,
      slug: b._id.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, ''),
      offers: b.count,
    }));
  } catch { return []; }
}

async function getNewBrands() {
  try {
    await connectDB();
    const brands = await Offer.aggregate([
      { $match: { status: 'published' } },
      { $sort: { updatedAt: -1 } },
      { $group: { _id: '$store_name', updatedAt: { $max: '$updatedAt' } } },
      { $sort: { updatedAt: -1 } },
      { $limit: 8 },
    ]);
    return brands.map(b => ({
      name: b._id,
      slug: b._id.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, ''),
    }));
  } catch { return []; }
}

export default async function HomePage() {
  const [trending, categories, popularBrands, newBrands] = await Promise.all([
    getTrendingOffers(),
    getCategories(),
    getPopularBrands(),
    getNewBrands(),
  ]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,#d9770608_0%,transparent_60%)]" />

      {/* HEADER */}
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Logo href="/" className="text-base" />
        <div className="flex items-center gap-2 sm:gap-3">
          <RegionSelector />
          <ThemeToggle />
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pt-10 pb-12 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ color: 'var(--text-primary)' }}>
          Find Promo Codes &amp; Deals
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm" style={{ color: 'var(--text-secondary)' }}>
          Verified discounts, promo codes, and deals. No expired codes. No login required.
        </p>
        <div className="mt-6">
          <SearchBar />
        </div>

        {/* Popular quick links */}
        {popularBrands.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Popular:</span>
            {popularBrands.slice(0, 8).map(b => (
              <Link key={b.slug} href={`/brand/${b.slug}`}
                className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:border-brand-500/50 hover:bg-brand-500/10"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                {b.name} <span className="text-[10px] opacity-50">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* TRENDING OFFERS */}
      {trending.length > 0 && (
        <section className="relative z-10 mx-auto max-w-5xl px-6 pb-10">
          <h2 className="text-xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>
            Trending Offers
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trending.map((o: any) => (
              <Link key={o._id.toString()} href={`/brand/${(o.store_slug || o.store_name || '').toLowerCase().replace(/ /g, '-')}`}
                className="glass-card p-4 hover:scale-[1.02] transition-transform">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {o.title || o.store_name}
                  </p>
                  {o.confidence >= 70 && (
                    <span className="shrink-0 text-[10px] rounded-full px-1.5 py-0.5 bg-green-500/15 text-green-400">
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {o.discount}{o.code ? <span className="ml-2 font-mono text-brand-500">{o.code}</span> : ''}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {o.updatedAt ? `Updated ${timeAgo(new Date(o.updatedAt))}` : ''} · {o.store_name}
                  </p>
                  {o.sourceUrl && (
                    <a href={o.sourceUrl} target="_blank" rel="nofollow sponsored noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-500 hover:bg-brand-500/25">
                      {o.code ? 'Use Code' : 'Get Deal'}
                    </a>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CATEGORIES */}
      {categories.length > 0 && (
        <section className="relative z-10 mx-auto max-w-5xl px-6 pb-10">
          <h2 className="text-xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>
            Browse by Category
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories.filter(c => c.brandCount > 0).slice(0, 20).map(cat => (
              <Link key={cat.slug} href={`/category/${cat.slug}`}
                className="glass-card px-4 py-2.5 text-sm font-medium transition-all hover:scale-[1.03]"
                style={{ color: 'var(--text-primary)' }}>
                {cat.name} <span className="text-xs opacity-50">→</span>
                <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>({cat.brandCount})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* NEW BRANDS */}
      {newBrands.length > 0 && (
        <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20">
          <h2 className="text-xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>
            Recently Updated Offers
          </h2>
          <div className="flex flex-wrap gap-2">
            {newBrands.map((b: any, i: number) => (
              <Link key={b.slug || i} href={`/brand/${b.slug}`}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:border-brand-500/50 hover:bg-brand-500/10"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                {b.name} <span className="text-[10px] opacity-50">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function timeAgo(date: Date) {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 2592000) return `${Math.floor(sec / 86400)}d ago`;
  return date.toLocaleDateString();
}
