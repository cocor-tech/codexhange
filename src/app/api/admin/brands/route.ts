import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Brand from '@/lib/models/Brand';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  await connectDB();

  const filter: any = {};
  if (category) filter.categories = category;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { website: { $regex: search, $options: 'i' } },
    ];
  }

  const [brands, total] = await Promise.all([
    Brand.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Brand.countDocuments(filter),
  ]);

  return NextResponse.json({ brands, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !body.website) {
    return NextResponse.json({ error: 'Name and website required' }, { status: 400 });
  }

  await connectDB();

  const brand = await Brand.create({
    ...body,
    slug: body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    discovery: body.discovery || { enabled: true, crawlDelay: 3000, crawlDepth: 2, allowGoogleSearch: false, allowSitemap: true, allowReferral: true },
  });

  return NextResponse.json({ brand }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { brandId, ...updates } = await req.json();
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 });

  await connectDB();
  const brand = await Brand.findByIdAndUpdate(brandId, updates, { new: true }).lean();
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

  return NextResponse.json({ brand });
}

export async function DELETE(req: NextRequest) {
  const { brandId } = await req.json();
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 });

  await connectDB();
  await Brand.findByIdAndDelete(brandId);

  return NextResponse.json({ ok: true });
}
