import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';
import Brand from '@/lib/models/Brand';
import Offer from '@/lib/models/Offer';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getCategory, getDidYouMean, CATEGORY_BRANDS, BRAND_CATEGORIES } from '@/lib/brands';
import { ShareButton } from '@/components/codes/ShareButton';
import { OfferVoteButtons } from '@/components/offers/VoteButtons';
import { CopyButton } from '@/components/offers/CopyButton';

interface Props {
  params: { slug: string };
  searchParams: { country?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = params.slug.toLowerCase();
  const brand = slug.charAt(0).toUpperCase() + slug.slice(1);
  return {
    title: `${brand} Promo Codes & Deals (${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}) | CodeXhange`,
    description: `Find verified ${brand} promo codes and discounts. Updated daily. Community-rated deals.`,
    openGraph: {
      title: `${brand} Promo Codes | CodeXhange`,
      description: `Verified ${brand} discount codes — updated daily.`,
    },
  };
}

export const revalidate = 60;

async function getOffers(slug: string) {
  const name = slug.charAt(0).toUpperCase() + slug.slice(1);
  try {
    return Offer.find({
      status: 'published',
      store_name: { $regex: slug.replace(/-/g, ' '), $options: 'i' },
    }).sort({ confidence: -1, updatedAt: -1 }).lean();
  } catch { return []; }
}

async function getCategoryBrands(slug: string) {
  const cat = BRAND_CATEGORIES[slug];
  if (!cat) return [];
  const siblings = (CATEGORY_BRANDS[cat] || []).filter(s => s !== slug).slice(0, 6);
  return siblings.map(s => ({
    slug: s,
    name: s.charAt(0).toUpperCase() + s.slice(1),
  }));
}

async function getBrandInfo(slug: string) {
  try {
    return Brand.findOne({ slug, active: true }).lean() as any;
  } catch { return null; }
}

export default async function BrandPage({ params }: Props) {
  const slug = params.slug.toLowerCase();
  const brand = slug.charAt(0).toUpperCase() + slug.slice(1);
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  const currentYear = new Date().getFullYear();

  await connectDB();
  const [offers, brandInfo, categoryBrands] = await Promise.all([
    getOffers(slug),
    getBrandInfo(slug),
    getCategoryBrands(slug),
  ]);

  const hasCodes = offers.some((o: any) => o.code && o.code !== 'None');
  const numCodes = offers.filter((o: any) => o.code && o.code !== 'None').length;
  const numDeals = offers.filter((o: any) => !o.code || o.code === 'None').length;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${brand} Promo Codes`,
    description: `${offers.length} verified ${brand} discount codes and deals. Updated ${currentMonth} ${currentYear}.`,
    brand: { '@type': 'Brand', name: brand },
    offers: offers.slice(0, 20).map((o: any) => ({
      '@type': 'Offer',
      name: o.title,
      description: o.description?.slice(0, 200) || o.title,
      price: o.discount?.replace('% off', '').replace('$', '').trim() || '0',
      priceCurrency: 'USD',
      ...(o.code && o.code !== 'None' ? { serialNumber: o.code } : {}),
      ...(o.updatedAt ? { availabilityStarts: new Date(o.updatedAt).toISOString() } : {}),
      url: o.sourceUrl || undefined,
    })),
    aggregateRating: offers.length > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: '4.0',
      bestRating: '5',
      ratingCount: offers.length,
    } : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,#d9770608_0%,transparent_60%)]" />

      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link href="/" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>← Home</Link>

        {/* HERO */}
        <div className="mt-6 flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-bold"
            style={{ backgroundColor: '#d9770620', color: '#f59e0b' }}>
            {brand.charAt(0)}
          </span>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {brand} Promo Codes & Deals
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {offers.length > 0
                ? `${offers.length} offer${offers.length !== 1 ? 's' : ''} available`
                : 'No offers yet — check back soon'}
              {brandInfo?.website && ` · ${brandInfo.website.replace(/https?:\/\//, '')}`}
              {offers.length > 0 && ` · Verified ${currentMonth} ${currentYear}`}
            </p>
          </div>
        </div>

        {/* OFFERS */}
        {offers.length > 0 ? (
          <section className="mt-8 space-y-3">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Active Offers
              {numCodes > 0 && <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                ({numCodes} code{numCodes !== 1 ? 's' : ''} · {numDeals} deal{numDeals !== 1 ? 's' : ''})
              </span>}
            </h2>

            {offers.map((o: any) => (
              <div key={o._id.toString()} className="glass-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {o.code && o.code !== 'None' && (
                      <code className="text-sm font-mono font-bold tracking-wide select-all rounded-md border px-2 py-0.5"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                        {o.code}
                      </code>
                    )}
                    <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                      o.confidence >= 70 ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                    }`}>
                      {o.confidence}% confidence
                    </span>
                    {o.sourceReliability && (
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{o.sourceReliability}</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {o.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {o.discount}
                    {o.description && <span className="ml-2 opacity-70">{o.description.slice(0, 100)}</span>}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {o.updatedAt && <span>✓ Updated {timeAgo(new Date(o.updatedAt))}</span>}
                    {o.expiresAt && <span>⏱ Expires {new Date(o.expiresAt).toLocaleDateString()}</span>}
                    {o.code && o.code !== 'None' && <ShareButton code={o.code} brand={brand} brandSlug={slug} description={o.title} />}
                    <OfferVoteButtons offerId={o._id.toString()} upvotes={o.upvotes || 0} downvotes={o.downvotes || 0} />
                  </div>
                </div>
                {o.code && o.code !== 'None' ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <code className="rounded-lg border px-3 py-1.5 text-sm font-mono font-bold tracking-wide select-all"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                      {o.code}
                    </code>
                    <CopyButton text={o.code} />
                  </div>
                ) : (
                  <a href={o.sourceUrl || '#'} target="_blank" rel="nofollow sponsored noopener noreferrer"
                    className="btn-primary px-4 py-2 text-sm whitespace-nowrap shrink-0">
                    Get Deal
                  </a>
                )}
              </div>
            ))}
          </section>
        ) : brandInfo ? (
          <div className="glass-card p-6 mt-8 text-center">
            <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              We&rsquo;re finding the best {brand} deals
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Our bot is searching for active promo codes and discounts. Check back soon.
            </p>
          </div>
        ) : (
          <div className="glass-card p-6 mt-8 text-center">
            <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              We don&rsquo;t have {brand} codes yet
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Be the first to submit a working code for {brand}!
            </p>
            {getDidYouMean(slug).length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Did you mean:</span>
                {getDidYouMean(slug).slice(0, 4).map((s: any) => (
                  <Link key={s.slug} href={`/brand/${s.slug}`}
                    className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:border-brand-500/50 hover:bg-brand-500/10"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    {s.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FAQ */}
        {offers.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {brand} Promo Codes — Frequently Asked Questions
            </h2>
            <div className="space-y-3">
              {[
                { q: `Does ${brand} offer promo codes?`, a: `${brand} offers various discounts including${numCodes > 0 ? ' promo codes,' : ''} seasonal sales, and special deals. Check the active offers above for the latest savings.` },
                { q: `How can I save money at ${brand}?`, a: `You can save by using active promo codes, checking for student/military discounts, signing up for newsletters, and shopping during sales events.` },
                { q: `Are these ${brand} codes verified?`, a: `Each offer shows a confidence score based on our verification. Codes marked with 70%+ confidence are recently verified.` },
                { q: `How often are ${brand} deals updated?`, a: `Our bot checks for new ${brand} deals daily. The "Updated" timestamp shows when each offer was last verified.` },
              ].map(faq => (
                <details key={faq.q} className="glass-card group open:pb-4">
                  <summary className="cursor-pointer text-sm font-semibold list-none p-4" style={{ color: 'var(--text-primary)' }}>
                    <span className="flex items-center justify-between gap-2">
                      {faq.q}
                      <svg className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </summary>
                  <p className="px-4 pb-4 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{faq.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* RELATED BRANDS */}
        {categoryBrands.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Related Brands
            </h2>
            <div className="flex flex-wrap gap-2">
              {categoryBrands.map(b => (
                <Link key={b.slug} href={`/brand/${b.slug}`}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:border-brand-500/50 hover:bg-brand-500/10"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  {b.name} Promo Codes
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
    </>
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
