import Link from 'next/link';
import { SearchBar } from '@/components/landing/SearchBar';
import { TrendingGrid } from '@/components/landing/TrendingGrid';
import { HotDealsStrip } from '@/components/landing/HotDealsStrip';
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
      { $sort: { activeCodes: -1 } },
      { $limit: 48 },
    ]).option({ timeout: 5000 });
    return brands;
  } catch {
    return [];
  }
}

export default async function AllPage() {
  const trendingBrands = await getTrendingBrands();

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

      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-16">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            All Brands
          </h2>
          <Link href="/" className="btn-primary px-4 py-2 text-xs">
            Browse
          </Link>
        </div>
        <TrendingGrid initial={trendingBrands} />
      </section>
    </div>
  );
}
