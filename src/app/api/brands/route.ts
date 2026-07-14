import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connectDB();

  const brands = await Code.aggregate([
    { $match: { archived: false } },
    {
      $group: {
        _id: { slug: '$brandSlug', name: '$brand' },
        activeCodes: { $sum: 1 },
        totalUpvotes: { $sum: '$upvotes' },
        totalDownvotes: { $sum: '$downvotes' },
        totalClicks: { $sum: '$clicks' },
      },
    },
    {
      $project: {
        _id: 0,
        slug: '$_id.slug',
        name: '$_id.name',
        activeCodes: 1,
        totalVotes: { $add: ['$totalUpvotes', '$totalDownvotes'] },
        totalUpvotes: 1,
        totalDownvotes: 1,
        totalClicks: 1,
        successRate: {
          $cond: [
            { $gt: [{ $add: ['$totalUpvotes', '$totalDownvotes'] }, 0] },
            {
              $multiply: [
                { $divide: ['$totalUpvotes', { $add: ['$totalUpvotes', '$totalDownvotes'] }] },
                100,
              ],
            },
            0,
          ],
        },
      },
    },
    { $sort: { activeCodes: -1, totalClicks: -1 } },
    { $limit: 50 },
  ]);

  return NextResponse.json({ brands });
}
