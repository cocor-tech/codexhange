import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Service from '@/lib/models/Service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  await connectDB();

  const filter: any = {};
  if (brandId) filter.brandId = brandId;

  const [services, total] = await Promise.all([
    Service.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).populate('brandId', 'name').lean(),
    Service.countDocuments(filter),
  ]);

  return NextResponse.json({ services, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !body.brandId) return NextResponse.json({ error: 'Name and brandId required' }, { status: 400 });

  await connectDB();
  const brand = await (await import('@/lib/models/Brand')).default.findById(body.brandId);
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

  const service = await Service.create({
    ...body,
    slug: body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  });

  return NextResponse.json({ service }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { serviceId, ...updates } = await req.json();
  if (!serviceId) return NextResponse.json({ error: 'serviceId required' }, { status: 400 });
  await connectDB();
  const service = await Service.findByIdAndUpdate(serviceId, updates, { new: true }).lean();
  return NextResponse.json({ service });
}

export async function DELETE(req: NextRequest) {
  const { serviceId } = await req.json();
  if (!serviceId) return NextResponse.json({ error: 'serviceId required' }, { status: 400 });
  await connectDB();
  await Service.findByIdAndDelete(serviceId);
  return NextResponse.json({ ok: true });
}
