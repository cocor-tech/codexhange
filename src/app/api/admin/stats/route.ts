import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { connectDB } from '@/lib/mongoose';
import Brand from '@/lib/models/Brand';
import Category from '@/lib/models/Category';
import Offer from '@/lib/models/Offer';
import Website from '@/lib/models/Website';
import User from '@/lib/models/User';
import Code from '@/lib/models/Code';
import Source from '@/lib/models/Source';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  await connectDB();

  const [
    pendingReview, totalBrands, totalOffers, totalUsers,
    totalWebsites,     totalCategories, totalCodes, publishedOffers,
    blockedSites, totalClicks, totalUpvotes, totalDownvotes,
    uniquePageviews, totalSources, activeSources,
    sourceBrands, sourceOffers, lastSourceScan,
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
    connectDB().then(m => m.connection.collection('pageviews').countDocuments({})).catch(() => 0),
    Source.countDocuments({}),
    Source.countDocuments({ status: 'active' }),
    Source.aggregate([{ $group: { _id: null, total: { $sum: '$stats.brands_found' } } }]).then(r => r[0]?.total || 0),
    Source.aggregate([{ $group: { _id: null, total: { $sum: '$stats.offers_found' } } }]).then(r => r[0]?.total || 0),
    Source.aggregate([{ $group: { _id: null, last: { $max: '$stats.last_scan' } } }]).then(r => r[0]?.last || null),
  ]);

  return NextResponse.json({
    pendingReview, totalBrands, totalOffers, totalUsers,
    totalWebsites, totalCategories, totalCodes, publishedOffers,
    blockedSites, totalClicks, totalUpvotes, totalDownvotes,
    uniquePageviews, totalSources, activeSources,
    sourceBrands, sourceOffers, lastSourceScan,
  });
}
