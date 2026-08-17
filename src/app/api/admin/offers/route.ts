import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { connectDB } from '@/lib/mongoose';
import Offer from '@/lib/models/Offer';
import OfferHistory from '@/lib/models/OfferHistory';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const offerId = searchParams.get('offerId');
  const serviceId = searchParams.get('serviceId');
  const status = searchParams.get('status');
  const dealType = searchParams.get('deal_type');
  const q = searchParams.get('q');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  await connectDB();

  // Single offer lookup
  if (offerId) {
    const offer = await Offer.findById(offerId).lean();
    return NextResponse.json({ offers: offer ? [offer] : [] });
  }

  const filter: any = {};
  const websiteId = searchParams.get('websiteId');
  if (serviceId) filter.serviceId = serviceId;
  if (websiteId) filter.websiteId = websiteId;
  if (status) filter.status = status;
  if (dealType) filter.deal_type = dealType;
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { store_name: { $regex: escaped, $options: 'i' } },
      { title: { $regex: escaped, $options: 'i' } },
      { sourceUrl: { $regex: escaped, $options: 'i' } },
      { code: { $regex: escaped, $options: 'i' } },
      { discount: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
    ];
  }

  const [offers, total] = await Promise.all([
    Offer.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: 'services',
          localField: 'serviceId',
          foreignField: '_id',
          as: 'service',
        },
      },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'brands',
          localField: 'service.brandId',
          foreignField: '_id',
          as: 'brand',
        },
      },
      { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          store_name: { $ifNull: ['$brand.name', '$store_name'] },
          store_slug: { $ifNull: ['$brand.slug', '$store_slug'] },
        },
      },
      { $project: { service: 0, brand: 0 } },
    ]),
    Offer.countDocuments(filter),
  ]);

  return NextResponse.json({ offers, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const body = await req.json();
  if (!body.serviceId || !body.title || !body.discount) {
    return NextResponse.json({ error: 'serviceId, title, and discount required' }, { status: 400 });
  }

  await connectDB();

  const offer = await Offer.create({
    ...body,
    status: body.status || 'pending_review',
    countries: body.countries || [],
    confidence: body.confidence ?? 90,
    sourceReliability: body.sourceReliability || 'Admin',
    verifiedBy: 'admin',
    verifiedAt: new Date(),
  });

  return NextResponse.json({ offer }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { offerId, ...updates } = await req.json();
  if (!offerId) return NextResponse.json({ error: 'offerId required' }, { status: 400 });

  await connectDB();

  const prevDoc = await Offer.findById(offerId);
  if (!prevDoc) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  const prev = prevDoc.toObject();

  const changedFields: Record<string, { from: any; to: any }> = {};
  for (const key of Object.keys(updates)) {
    if (JSON.stringify((prev as any)[key]) !== JSON.stringify(updates[key])) {
      changedFields[key] = { from: (prev as any)[key], to: updates[key] };
    }
  }

  const newStatus = updates.status || prev.status;
  if (newStatus === 'published' && !prev.verifiedAt) {
    updates.verifiedAt = new Date();
    updates.verifiedBy = 'admin';
  }

  const offer = await Offer.findByIdAndUpdate(offerId, updates, { new: true }).lean();

  if (Object.keys(changedFields).length > 0) {
    await OfferHistory.create({
      offerId,
      changedFields,
      previousStatus: prev.status,
      newStatus: newStatus,
      changedBy: 'admin',
    });
  }

  return NextResponse.json({ offer });
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { offerId } = await req.json();
  if (!offerId) return NextResponse.json({ error: 'offerId required' }, { status: 400 });
  await connectDB();
  await Offer.findByIdAndDelete(offerId);
  await OfferHistory.deleteMany({ offerId });
  return NextResponse.json({ ok: true });
}
