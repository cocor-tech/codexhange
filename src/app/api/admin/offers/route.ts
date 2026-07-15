import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Offer from '@/lib/models/Offer';
import OfferHistory from '@/lib/models/OfferHistory';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const offerId = searchParams.get('offerId');
  const serviceId = searchParams.get('serviceId');
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  await connectDB();

  // Single offer lookup
  if (offerId) {
    const offer = await Offer.findById(offerId).lean();
    return NextResponse.json({ offers: offer ? [offer] : [] });
  }

  const filter: any = {};
  if (serviceId) filter.serviceId = serviceId;
  if (status) filter.status = status;

  const [offers, total] = await Promise.all([
    Offer.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Offer.countDocuments(filter),
  ]);

  return NextResponse.json({ offers, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
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
  const { offerId } = await req.json();
  if (!offerId) return NextResponse.json({ error: 'offerId required' }, { status: 400 });
  await connectDB();
  await Offer.findByIdAndDelete(offerId);
  await OfferHistory.deleteMany({ offerId });
  return NextResponse.json({ ok: true });
}
