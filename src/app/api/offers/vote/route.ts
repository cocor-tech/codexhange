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
  const { offerId, vote } = await req.json();
  if (!offerId || !['up', 'down'].includes(vote)) {
    return NextResponse.json({ error: 'offerId and vote (up/down) required' }, { status: 400 });
  }

  await connectDB();
  const mongoose = await connectDB();
  const votesCol = mongoose.connection.collection('offer_votes') as any;

  const did = deviceId(req);
  const existing = await votesCol.findOne({ offerId, deviceId: did });

  if (existing) {
    if (existing.vote === vote) {
      return NextResponse.json({ error: 'Already voted', upvotes: 0, downvotes: 0 }, { status: 409 });
    }
    // User is changing vote — remove old, add new
    await votesCol.deleteOne({ _id: existing._id });
    const oldField = existing.vote === 'up' ? 'upvotes' : 'downvotes';
    await Offer.findByIdAndUpdate(offerId, { $inc: { [oldField]: -1 } });
  }

  // Ensure TTL index (auto-delete after 365 days)
  try {
    await votesCol.createIndex({ createdAt: 1 }, { expireAfterSeconds: 31536000 });
  } catch {}

  await votesCol.insertOne({
    offerId, deviceId: did, vote,
    createdAt: new Date(),
  });

  const field = vote === 'up' ? 'upvotes' : 'downvotes';
  const offer = await Offer.findByIdAndUpdate(
    offerId,
    { $inc: { [field]: 1 } },
    { new: true }
  ).lean();

  if (!offer) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    upvotes: offer.upvotes,
    downvotes: offer.downvotes,
    changed: existing ? true : false,
  });
}
