import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Brand from '@/lib/models/Brand';
import Category from '@/lib/models/Category';
import Offer from '@/lib/models/Offer';
import Website from '@/lib/models/Website';
import User from '@/lib/models/User';
import Code from '@/lib/models/Code';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connectDB();

  const [
    pendingReview, totalBrands, totalOffers, totalUsers,
    totalWebsites, totalCategories, totalCodes, publishedOffers,
    blockedSites, totalClicks, totalUpvotes, totalDownvotes,
  ] = await Promise.all([
    Offer.countDocuments({ status: 'pending_review' }),
    Brand.countDocuments({}),
    Offer.countDocuments({}),
    User.countDocuments({ isAdmin: true }),
    Website.countDocuments({}),
    Category.countDocuments({}),
    Code.countDocuments({}),
    Offer.countDocuments({ status: 'published' }),
    Website.countDocuments({ status: 'blocked' }),
    Offer.aggregate([{ $group: { _id: null, total: { $sum: '$clicks' } } }]).then(r => r[0]?.total || 0),
    Offer.aggregate([{ $group: { _id: null, total: { $sum: '$upvotes' } } }]).then(r => r[0]?.total || 0),
    Offer.aggregate([{ $group: { _id: null, total: { $sum: '$downvotes' } } }]).then(r => r[0]?.total || 0),
  ]);

  return NextResponse.json({
    pendingReview, totalBrands, totalOffers, totalUsers,
    totalWebsites, totalCategories, totalCodes, publishedOffers,
    blockedSites, totalClicks, totalUpvotes, totalDownvotes,
  });
}
