import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';
import { BRAND_CATEGORIES, CATEGORIES } from '@/lib/brands';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.toLowerCase().trim();

  if (!q || q.length < 1) {
    return NextResponse.json({ brands: [], categories: [] });
  }

  await connectDB();

  const brandResults = await Code.aggregate([
    { $match: { archived: false, brandSlug: { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' } } },
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

  const matchedCategories = CATEGORIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 3);

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
    ...(brandResults.length > 0
      ? [{ type: 'brand' as const, label: 'Brand Suggestions', items: brandResults }]
      : []),
    ...(categorySlugs.length > 0
      ? [
          {
            type: 'category' as const,
            label: 'Category Suggestions',
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
