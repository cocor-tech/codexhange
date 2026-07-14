import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getCategory, getDidYouMean, getRelatedSearches, CATEGORY_BRANDS, BRAND_CATEGORIES } from '@/lib/brands';
import { VoteButtons } from '@/components/codes/VoteButtons';
import { ShareButton } from '@/components/codes/ShareButton';

interface Props {
  params: { slug: string };
  searchParams: { country?: string };
}

const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
const currentYear = new Date().getFullYear();

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const slug = params.slug.toLowerCase();
  const brand = slug.charAt(0).toUpperCase() + slug.slice(1);
  const country = searchParams.country?.toUpperCase();
  const countryPath = country ? `/${country.toLowerCase()}/` : '/';
  const known = !!BRAND_CATEGORIES[slug];

  return {
    title: known
      ? `${brand} Promo Codes & Discounts (${currentMonth} ${currentYear}) | CodeXhange`
      : `${brand} Promo Codes — Not Found | CodeXhange`,
    description: known
      ? `Find verified ${brand} promo codes and discounts for ${currentMonth} ${currentYear}. Community-rated and always up to date.`
      : `No active codes found for ${brand}. Browse similar verified discount codes from related brands.`,
    alternates: {
      canonical: `https://codexhange.com${countryPath}brand/${slug}`,
      languages: country ? { [`en-${country}`]: `https://codexhange.com${countryPath}brand/${slug}` } : undefined,
    },
    openGraph: {
      title: `${brand} Promo Codes | CodeXhange`,
      description: `Verified ${brand} discount codes — updated daily by the community.`,
    },
  };
}

export const revalidate = 60;

async function getBrandCodes(slug: string, country?: string) {
  const filter: any = { brandSlug: slug.toLowerCase(), archived: false };
  if (country) {
    filter.$or = [{ scope: 'global' }, { country: country.toUpperCase() }];
  }
  return Code.find(filter)
    .sort({ createdAt: -1 })
    .lean();
}

async function getCategoryCodes(category: string, excludeSlug: string, limit = 6) {
  const catSlugs = (CATEGORY_BRANDS[category] || []).filter((s) => s !== excludeSlug);
  if (catSlugs.length === 0) return [];
  return Code.aggregate([
    { $match: { brandSlug: { $in: catSlugs }, archived: false } },
    {
      $group: {
        _id: { slug: '$brandSlug', name: '$brand' },
        activeCodes: { $sum: 1 },
        totalUpvotes: { $sum: '$upvotes' },
        totalDownvotes: { $sum: '$downvotes' },
      },
    },
    {
      $project: {
        _id: 0,
        slug: '$_id.slug',
        name: '$_id.name',
        activeCodes: 1,
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
    { $limit: limit },
  ]);
}

export default async function BrandPage({ params, searchParams }: Props) {
  const slug = params.slug.toLowerCase();
  const brand = slug.charAt(0).toUpperCase() + slug.slice(1);
  const country = searchParams.country?.toUpperCase();

  await connectDB();
  const codes = await getBrandCodes(slug, country);
  const hasCodes = codes.length > 0;

  const category = getCategory(slug);
  const didYouMean = hasCodes ? [] : getDidYouMean(slug);
  const similarBrands = hasCodes ? [] : await getCategoryCodes(category, slug);
  const relatedSearches = getRelatedSearches(category);

  const brandTitle = `${brand} Promo Codes & Discounts`;
  const pageTitle = hasCodes ? `${brandTitle} (${currentMonth} ${currentYear})` : `${brand} — Not Found`;

  const jsonLd = hasCodes ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${brand} Promo Codes`,
    description: `Community-verified ${brand} discount codes. Updated ${currentMonth} ${currentYear}.`,
    offers: codes.map((c: any) => ({
      '@type': 'Offer',
      priceSpecification: { '@type': 'UnitPriceSpecification', price: c.discount },
      description: c.description,
      availability: 'https://schema.org/InStock',
    })),
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.2',
      bestRating: '5',
      ratingCount: codes.length,
    },
  } : {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${brand} Promo Codes`,
    description: `Browse similar verified discount codes from related brands.`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,#d9770608_0%,transparent_60%)]" />

        {/* ── HEADER ── */}
        <header className="relative z-10 mx-auto max-w-5xl px-6 py-5">
          <Link href="/" className="text-sm font-medium transition-colors" style={{ color: 'var(--text-secondary)' }}>
            &larr; Back to Home
          </Link>
        </header>

        <main className="relative z-10 mx-auto max-w-4xl px-6 pb-32">
          {/* ── BREADCRUMBS ── */}
          <nav aria-label="Breadcrumb" className="mb-6 text-xs" style={{ color: 'var(--text-muted)' }}>
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link href="/" className="hover:text-[--text-primary] transition-colors">Home</Link></li>
              <li aria-hidden="true">/</li>
              {country && (
                <>
                  <li><Link href={`/${country.toLowerCase()}`} className="hover:text-[--text-primary] transition-colors">{country}</Link></li>
                  <li aria-hidden="true">/</li>
                </>
              )}
              <li><span style={{ color: 'var(--text-primary)' }}>{brand}</span></li>
            </ol>
          </nav>

          {hasCodes ? (
            /* ── CODES FOUND ── */
            <>
              <div className="mb-10 text-center">
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
                  {pageTitle}
                </h1>
                {country && <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Showing codes available in {country}</p>}
                <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {codes.length} active code{codes.length !== 1 ? 's' : ''} — all verified by the community
                </p>
              </div>

              <div className="space-y-4">
                {codes.map((code: any) => (
                  <article key={code._id.toString()} className="glass-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{code.scope === 'global' ? 'Global' : code.country}</span>
                        {code.expiresAt && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Expires {new Date(code.expiresAt).toLocaleDateString()}</span>}
                      </div>
                      <h3 className="mt-1 text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{code.description}</h3>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}><span className="font-semibold">Discount:</span> {code.discount}</p>
                      {code.restrictions && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{code.restrictions}</p>}
                      <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <VoteButtons codeId={code._id.toString()} upvotes={code.upvotes} downvotes={code.downvotes} />
                        <span>{code.clicks} clicks</span>
                        <span>Submitted {new Date(code.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <code className="rounded-lg border px-3 py-1.5 text-sm font-mono font-bold tracking-wide select-all" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>{code.code}</code>
                      {code.affiliateLink ? (
                        <a href={code.affiliateLink} target="_blank" rel="nofollow sponsored noopener noreferrer" className="btn-primary px-4 py-1.5 text-sm whitespace-nowrap">Get Deal</a>
                      ) : code.link ? (
                        <a href={`/go?url=${encodeURIComponent(code.link)}&ref=${slug}`} target="_blank" rel="nofollow sponsored noopener noreferrer" className="btn-primary px-4 py-1.5 text-sm whitespace-nowrap">Use Code</a>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 sm:flex-col sm:gap-1">
                      <ShareButton code={code.code} brand={code.brand} brandSlug={code.brandSlug} description={code.description} />
                    </div>
                  </article>
                ))}
              </div>

              <section className="mt-12 glass-card">
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>How to Use {brand} Promo Codes</h2>
                <ol className="mt-3 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <li>1. Click <strong style={{ color: 'var(--text-primary)' }}>&ldquo;Use Code&rdquo;</strong> next to any active promo code above.</li>
                  <li>2. You will be redirected to {brand}&rsquo;s checkout page.</li>
                  <li>3. Copy the code and paste it into the promo code field at checkout.</li>
                  <li>4. Verify the discount is applied before completing your purchase.</li>
                </ol>
                <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Some codes have restrictions. Check the details listed with each code.
                </p>
              </section>
            </>
          ) : (
            /* ── NO CODES FOUND — THE "TEMU MATCH" LAYOUT ── */
            <>
              {/* Did You Mean? */}
              {didYouMean.length > 0 && (
                <div className="glass-card mb-8">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>💡 Did you mean:</p>
                  <div className="flex flex-wrap gap-2">
                    {didYouMean.map((s) => (
                      <Link
                        key={s.slug}
                        href={`/brand/${s.slug}`}
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:border-brand-500/50 hover:bg-brand-500/10"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                      >
                        {s.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* No results CTA */}
              <div className="glass-card text-center py-12 mb-8">
                <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  We don&rsquo;t have codes for {brand} yet
                </p>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Be the first to submit a working code for {brand}!
                </p>
                <Link
                  href="/"
                  className="btn-primary mt-6 inline-flex px-5 py-2.5 text-sm"
                >
                  Browse All Codes &rarr;
                </Link>
              </div>

              {/* Similar offers in category */}
              {similarBrands.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                    Similar Offers in {category}
                  </h2>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                    We don&rsquo;t have {brand} codes yet. Here are similar active deals:
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {similarBrands.map((b: any) => (
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
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {b.activeCodes} active code{b.activeCodes !== 1 ? 's' : ''} &middot; {Math.round(b.successRate)}% success
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Searches */}
              <div className="glass-card">
                <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Related Searches</h2>
                <div className="flex flex-wrap gap-2">
                  {relatedSearches.map((s) => (
                    <Link
                      key={s}
                      href={`/brand/${slug}`}
                      className="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:border-brand-500/50 hover:bg-brand-500/10"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                    >
                      {s}
                    </Link>
                  ))}
                  <Link
                    href="/brand/nordvpn"
                    className="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:border-brand-500/50 hover:bg-brand-500/10"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    Browse All Active Codes
                  </Link>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
