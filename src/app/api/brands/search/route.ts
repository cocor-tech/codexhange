import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';

export const dynamic = 'force-dynamic';
import { BRAND_CATEGORIES, CATEGORIES } from '@/lib/brands';
import { classifyInput } from '@/lib/search';

export async function GET(req: NextRequest) {
  const rawQ = req.nextUrl.searchParams.get('q')?.trim();
  if (!rawQ || rawQ.length < 1) {
    return NextResponse.json({ suggestions: [], brands: [] });
  }

  const input = classifyInput(rawQ);
  let q: string;

  if (input.type === 'url' && input.extracted) {
    q = input.extracted.slug;
  } else {
    q = rawQ.toLowerCase().replace(/[^a-z0-9\s-]/g, '');
  }

  await connectDB();

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const brandResults = await Code.aggregate([
    {
      $match: {
        archived: false,
        $or: [
          { brandSlug: { $regex: escaped, $options: 'i' } },
          { brand: { $regex: escaped, $options: 'i' } },
          { description: { $regex: escaped, $options: 'i' } },
        ],
      },
    },
    {
      $group: {
        _id: { slug: '$brandSlug', name: '$brand' },
        activeCodes: { $sum: 1 },
      },
    },
    { $project: { _id: 0, slug: '$_id.slug', name: '$_id.name', activeCodes: 1 } },
    { $sort: { activeCodes: -1 } },
    { $limit: 5 },
  ]);

  const matchedCategories = CATEGORIES.filter((c) => c.toLowerCase().includes(q.toLowerCase())).slice(0, 3);

  const brandSlugs = brandResults.map((b: any) => b.slug);
  const categorySlugs = matchedCategories
    .flatMap((c) => {
      const slugs = Object.entries(BRAND_CATEGORIES)
        .filter(([_, cat]) => cat === c)
        .map(([slug]) => slug);
      return slugs.filter((s) => !brandSlugs.includes(s));
    })
    .slice(0, 4);

  const suggestions = [
    ...(input.type === 'url' && input.extracted
      ? [
          {
            type: 'brand' as const,
            label: '🔗 Link Detected',
            items: [{ slug: input.extracted.slug, name: input.extracted.brand, activeCodes: brandResults.find((b: any) => b.slug === input.extracted?.slug)?.activeCodes || 0 }],
          },
        ]
      : []),
    ...(brandResults.length > 0
      ? [{ type: 'brand' as const, label: '🏢 Brands', items: brandResults }]
      : []),
    ...(categorySlugs.length > 0
      ? [
          {
            type: 'category' as const,
            label: '📦 Categories',
            items: categorySlugs.map((s) => ({
              slug: s,
              name: s.charAt(0).toUpperCase() + s.slice(1),
              category: BRAND_CATEGORIES[s],
            })),
          },
        ]
      : []),
  ];

  return NextResponse.json({ suggestions, brands: brandResults });
}
