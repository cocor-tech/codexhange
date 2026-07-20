import Link from 'next/link';
import type { Metadata } from 'next';
import { connectDB } from '@/lib/mongoose';
import Brand from '@/lib/models/Brand';
import Category from '@/lib/models/Category';
import Offer from '@/lib/models/Offer';

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = params.slug.toLowerCase();
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    title: `${name} Promo Codes & Deals | CodeXhange`,
    description: `Find verified ${name} promo codes, discounts, and deals. Community-rated and updated daily.`,
  };
}

export const revalidate = 300;

export default async function CategoryPage({ params }: Props) {
  const slug = params.slug.toLowerCase();

  await connectDB();
  const category = await Category.findOne({ slug }).lean() as any;
  const name = category?.name || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const brands = await Brand.find({ active: true })
    .populate('categories')
    .lean() as any[];

  const filtered = category
    ? brands.filter((b: any) => b.categories?.some((c: any) => c._id?.toString() === category._id.toString() || c === category._id))
    : brands;

  const brandOffers = await Promise.all(
    filtered.slice(0, 30).map(async (b: any) => {
      const offers = await Offer.find({ status: 'published', store_name: b.name })
        .sort({ confidence: -1 })
        .limit(3)
        .lean();
      return { brand: b, offers };
    })
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Home</Link>
        <h1 className="text-3xl font-extrabold mt-4" style={{ color: 'var(--text-primary)' }}>
          {name} Promo Codes & Deals
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {filtered.length} brands · Offers verified and updated daily
        </p>

        <div className="mt-8 space-y-6">
          {brandOffers.map(({ brand, offers }) => (
            <div key={brand._id.toString()} className="glass-card p-5">
              <Link href={`/brand/${brand.slug}`} className="flex items-center gap-3 mb-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold"
                  style={{ backgroundColor: '#d9770620', color: '#f59e0b' }}>
                  {brand.name.charAt(0)}
                </span>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{brand.name}</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {offers.length} active offer{offers.length !== 1 ? 's' : ''}
                    {brand.website && ` · ${brand.website.replace(/https?:\/\//, '')}`}
                  </p>
                </div>
              </Link>

              {offers.length > 0 && (
                <div className="space-y-2">
                  {offers.map((o: any) => (
                    <div key={o._id.toString()} className="flex items-center justify-between rounded-lg border p-3"
                      style={{ borderColor: 'var(--border)' }}>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {o.title}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {o.discount}{o.code ? <span className="ml-2 font-mono text-brand-500">{o.code}</span> : ''}
                        </p>
                      </div>
                      <a href={o.sourceUrl || '#'} target="_blank" rel="nofollow noopener noreferrer"
                        className="btn-primary px-3 py-1.5 text-xs whitespace-nowrap shrink-0 ml-3">
                        {o.code ? 'Use Code' : 'Get Deal'}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
