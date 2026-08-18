import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Offer from '@/lib/models/Offer';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function deviceId(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('x-real-ip') || 'unknown';
  const ua = req.headers.get('user-agent') || 'unknown';
  return crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex');
}

export async function POST(req: NextRequest) {
  const { offerId, rating } = await req.json();
  const r = Number(rating);
  if (!offerId || !Number.isInteger(r) || r < 1 || r > 5) {
    return NextResponse.json({ error: 'offerId and rating (1-5) required' }, { status: 400 });
  }

  const mongoose = await connectDB();
  const ratingsCol = mongoose.connection.collection('offer_ratings') as any;

  const did = deviceId(req);
  await ratingsCol.updateOne(
    { offerId, deviceId: did },
    { $set: { rating: r, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  const ratings = await ratingsCol.find({ offerId }).toArray();
  const avg = ratings.length
    ? ratings.reduce((s: number, x: any) => s + (x.rating || 0), 0) / ratings.length
    : 0;

  const offer = await Offer.findByIdAndUpdate(
    offerId,
    { $set: { avgRating: Math.round(avg * 10) / 10, ratingCount: ratings.length } },
    { new: true }
  ).lean() as any;

  if (!offer) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    avgRating: offer.avgRating || 0,
    ratingCount: offer.ratingCount || 0,
    rating: r,
  });
}
