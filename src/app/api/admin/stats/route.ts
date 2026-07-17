import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Brand from '@/lib/models/Brand';
import Offer from '@/lib/models/Offer';
import User from '@/lib/models/User';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connectDB();

  const [pendingReview, totalBrands, totalOffers, totalUsers] = await Promise.all([
    Offer.countDocuments({ status: 'pending_review' }),
    Brand.countDocuments({}),
    Offer.countDocuments({}),
    User.countDocuments({ isAdmin: true }),
  ]);

  return NextResponse.json({ pendingReview, totalBrands, totalOffers, totalUsers });
}
