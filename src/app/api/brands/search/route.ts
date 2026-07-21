import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Offer from '@/lib/models/Offer';
import Brand from '@/lib/models/Brand';
import { BRAND_CATEGORIES, CATEGORIES } from '@/lib/brands';
import { classifyInput } from '@/lib/search';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const rawQ = req.nextUrl.searchParams.get('q')?.trim();
  if (!rawQ || rawQ.length < 1) {
    return NextResponse.json({ suggestions: [], brands: [] });
  }

  const input = classifyInput(rawQ);
  const q = input.type === 'url' && input.extracted
    ? input.extracted.slug
    : rawQ.toLowerCase().replace(/[^a-z0-9\s-]/g, '');

  await connectDB();

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Search offers + brands in parallel
  const [offerBrands, dbBrands] = await Promise.all([
    Offer.aggregate([
      { $match: { status: 'published', store_name: { $regex: escaped, $options: 'i' } } },
      { $group: { _id: '$store_name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    Brand.find({ active: true, name: { $regex: escaped, $options: 'i' } })
      .select('name slug')
      .limit(5)
      .lean(),
  ]);

  const brandItems = [
    ...offerBrands.map((b: any) => ({
      slug: b._id.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, ''),
      name: b._id,
      activeCodes: b.count,
    })),
    ...(dbBrands as any[]).map(b => ({
      slug: b.slug,
      name: b.name,
      activeCodes: 0,
    })),
  ];

  // Dedup by slug
  const seen = new Set();
  const uniqueBrands = brandItems.filter(b => {
    if (seen.has(b.slug)) return false;
    seen.add(b.slug);
    return true;
  }).slice(0, 5);

  const matchedCategories = CATEGORIES.filter(c => c.toLowerCase().includes(q.toLowerCase())).slice(0, 3);

  const suggestions = [
    ...(input.type === 'url' && input.extracted
      ? [{
          type: 'brand' as const,
          label: '🔗 Link Detected',
          items: [{ slug: input.extracted.slug, name: input.extracted.brand, activeCodes: uniqueBrands.find(b => b.slug === input.extracted?.slug)?.activeCodes || 0 }],
        }]
      : []),
    ...(uniqueBrands.length > 0
      ? [{ type: 'brand' as const, label: '🏢 Brands', items: uniqueBrands }]
      : []),
    ...(matchedCategories.length > 0
      ? [{
          type: 'category' as const,
          label: '📦 Categories',
          items: matchedCategories.map(c => ({
            slug: c.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            name: c,
            category: c,
          })),
        }]
      : []),
  ];

  return NextResponse.json({ suggestions, brands: uniqueBrands });
}
