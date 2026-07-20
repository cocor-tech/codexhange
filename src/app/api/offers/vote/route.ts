import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Offer from '@/lib/models/Offer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { offerId, vote } = await req.json();
  if (!offerId || !['up', 'down'].includes(vote)) {
    return NextResponse.json({ error: 'offerId and vote (up/down) required' }, { status: 400 });
  }

  await connectDB();

  const field = vote === 'up' ? 'upvotes' : 'downvotes';
  const offer = await Offer.findByIdAndUpdate(
    offerId,
    { $inc: { [field]: 1 } },
    { new: true }
  ).lean();

  if (!offer) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, upvotes: offer.upvotes, downvotes: offer.downvotes });
}
