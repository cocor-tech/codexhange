import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Offer from '@/lib/models/Offer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const mongoose = await connectDB();
  const db = mongoose.connection.db as any;

  const offer = await Offer.findById(params.id).lean() as any;
  if (!offer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Get history
  const history = await db.collection('offerhistories')
    .find({ offerId: params.id })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();

  return NextResponse.json({ offer, history });
}
