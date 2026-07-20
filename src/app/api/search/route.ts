import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';
import Offer from '@/lib/models/Offer';

export const dynamic = 'force-dynamic';
import { BRAND_CATEGORIES, CATEGORIES } from '@/lib/brands';
import { classifyInput, shouldNoindex, normalizeText } from '@/lib/search';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('q')?.trim() || '';
  const category = req.nextUrl.searchParams.get('category');
  const country = req.nextUrl.searchParams.get('country');
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '20')));

  const input = classifyInput(raw);
  const q = input.type === 'url' && input.extracted ? input.extracted.slug : normalizeText(raw);

  await connectDB();

  const escaped = q ? q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';

  const codeFilter: any = { archived: false };
  if (escaped) {
    codeFilter.$or = [
      { brand: { $regex: escaped, $options: 'i' } },
      { brandSlug: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
      { discount: { $regex: escaped, $options: 'i' } },
      { code: { $regex: escaped, $options: 'i' } },
    ];
  }

  if (country) {
    codeFilter.$or = codeFilter.$or || [];
    codeFilter.$or.push({ scope: 'global' }, { country: country.toUpperCase() });
  }

  if (category && category !== 'all') {
    const catSlugs = Object.entries(BRAND_CATEGORIES)
      .filter(([_, cat]) => cat === category)
      .map(([slug]) => slug);
    if (catSlugs.length > 0) {
      codeFilter.brandSlug = { $in: catSlugs };
    }
  }

  const [codeResults, codeTotal, offerResults] = await Promise.all([
    Code.find(codeFilter)
      .sort({ upvotes: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Code.countDocuments(codeFilter),
    escaped ? Offer.find({
      status: 'published',
      $or: [
        { store_name: { $regex: escaped, $options: 'i' } },
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { discount: { $regex: escaped, $options: 'i' } },
        { code: { $regex: escaped, $options: 'i' } },
      ],
    })
      .sort({ confidence: -1 })
      .limit(10)
      .lean() : [],
  ]);

  const brandMap = new Map<string, { slug: string; name: string; codes: any[]; offers: any[]; category: string }>();
  for (const code of codeResults) {
    const slug = (code as any).brandSlug;
    if (!brandMap.has(slug)) {
      brandMap.set(slug, {
        slug,
        name: (code as any).brand,
        codes: [],
        offers: [],
        category: BRAND_CATEGORIES[slug] || 'Popular',
      });
    }
    brandMap.get(slug)!.codes.push(code);
  }

  for (const offer of offerResults) {
    const slug = ((offer as any).store_slug || (offer as any).store_name || '').toLowerCase().replace(/ /g, '-');
    const name = (offer as any).store_name || '';
    if (!brandMap.has(slug)) {
      brandMap.set(slug, {
        slug,
        name,
        codes: [],
        offers: [],
        category: BRAND_CATEGORIES[slug] || 'Popular',
      });
    }
    brandMap.get(slug)!.offers.push(offer);
  }

  const brands = Array.from(brandMap.values());

  const total = codeTotal + offerResults.length;

  const didYouMean = q && total === 0
    ? Object.entries(BRAND_CATEGORIES)
        .filter(([slug]) => {
          const s = slug.toLowerCase();
          const ql = q.toLowerCase();
          return s.includes(ql) || ql.includes(s) || levenshtein(s, ql) <= 2 || ql.split(' ').some((w) => s.startsWith(w));
        })
        .slice(0, 6)
        .map(([slug, cat]) => ({ slug, name: slug.charAt(0).toUpperCase() + slug.slice(1), category: cat }))
        .filter((b) => !brandMap.has(b.slug))
    : [];

  const matchedCategories = q
    ? CATEGORIES.filter((c) => c.toLowerCase().includes(q.toLowerCase())).slice(0, 5)
    : [];

  const matchedCategory = codeTotal === 0 && input.type === 'url' && input.extracted
    ? (BRAND_CATEGORIES[input.extracted.slug] || 'Popular')
    : null;

  return NextResponse.json({
    brands,
    total,
    page,
    pages: Math.ceil(codeTotal / limit),
    didYouMean: didYouMean.slice(0, 4),
    categories: matchedCategories,
    query: q,
    rawQuery: raw,
    inputType: input.type,
    extractedBrand: input.extracted || null,
    noindex: shouldNoindex(raw, total),
    matchedCategory,
  });
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
