import Link from 'next/link';
import { SearchBar } from '@/components/landing/SearchBar';
import { HotDealsStrip } from '@/components/landing/HotDealsStrip';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';
import Brand from '@/lib/models/Brand';
import Category from '@/lib/models/Category';
import { CATEGORIES as FALLBACK_CATEGORIES, CATEGORY_BRANDS, BRAND_CATEGORIES } from '@/lib/brands';

export const revalidate = 300;

async function getAllBrands() {
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
      { $sort: { activeCodes: -1 } },
    ]).option({ timeout: 5000 });
    return brands;
  } catch {
    return [];
  }
}

async function getCategoryGroups() {
  try {
    await connectDB();
    const dbCategories = await Category.find({ active: true }).sort({ order: 1, name: 1 }).lean();
    if (dbCategories.length > 0) {
      const groups = await Promise.all(
        dbCategories.map(async (cat: any) => {
          const dbBrands = await Brand.find({ categories: cat._id, active: true }).lean();
          return {
            name: cat.name,
            slug: cat.slug,
            brands: dbBrands.map((b: any) => ({
              slug: b.slug,
              name: b.name,
              website: b.website,
            })),
          };
        })
      );
      return groups.filter(g => g.brands.length > 0);
    }
  } catch {}
  return FALLBACK_CATEGORIES.map(cat => ({
    name: cat,
    slug: cat.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    brands: (CATEGORY_BRANDS[cat] || []).map(slug => ({
      slug,
      name: slug.charAt(0).toUpperCase() + slug.slice(1),
      website: undefined as string | undefined,
    })),
  }));
}

export default async function AllPage() {
  const [allBrands, categoryGroups] = await Promise.all([
    getAllBrands(),
    getCategoryGroups(),
  ]);

  const brandMap = new Map(allBrands.map(b => [b.slug, b]));

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#d9770606_0%,transparent_60%)]" />

      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-8 pt-20 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
          All Promo Codes
        </h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Browse every brand and find working discount codes verified by the community.
        </p>
        <div className="mt-6">
          <SearchBar />
        </div>
      </section>

      <HotDealsStrip />

      {/* ── CATEGORY NAV ── */}
      <nav className="relative z-10 mx-auto max-w-5xl px-6 pb-6 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {categoryGroups.map(cat => (
            <a
              key={cat.slug}
              href={`#cat-${cat.slug}`}
              className="rounded-lg border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors hover:border-brand-500/50 hover:bg-brand-500/10"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              {cat.name} ({cat.brands.length})
            </a>
          ))}
        </div>
      </nav>

      {/* ── CATEGORY SECTIONS ── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-16 space-y-10">
        {categoryGroups.map(cat => (
          <div key={cat.slug} id={`cat-${cat.slug}`}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {cat.name}
              <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                ({cat.brands.length} brand{cat.brands.length !== 1 ? 's' : ''})
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cat.brands.map(b => {
                const enriched = brandMap.get(b.slug);
                return (
                  <Link
                    key={b.slug}
                    href={`/brand/${b.slug}`}
                    className="glass-card flex items-center gap-3 p-3.5 hover:scale-[1.02] transition-transform"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold" style={{ backgroundColor: '#d9770620', color: '#f59e0b' }}>
                      {b.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{b.name}</p>
                      {enriched ? (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {enriched.activeCodes} code{enriched.activeCodes !== 1 ? 's' : ''}
                          {enriched.successRate > 0 && ` · ${Math.round(enriched.successRate)}% success`}
                        </p>
                      ) : b.website ? (
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{b.website.replace(/https?:\/\//, '')}</p>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
