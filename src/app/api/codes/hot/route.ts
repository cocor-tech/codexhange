import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';

export const revalidate = 120;

export async function GET() {
  await connectDB();

  const hot = await Code.aggregate([
    { $match: { archived: false, scope: 'global' } },
    {
      $addFields: {
        totalVotes: { $add: ['$upvotes', '$downvotes'] },
        successRate: {
          $cond: [
            { $gt: [{ $add: ['$upvotes', '$downvotes'] }, 0] },
            { $divide: ['$upvotes', { $add: ['$upvotes', '$downvotes'] }] },
            0,
          ],
        },
      },
    },
    { $match: { totalVotes: { $gte: 3 }, successRate: { $gte: 0.6 } } },
    { $sort: { upvotes: -1, clicks: -1 } },
    { $limit: 4 },
    {
      $project: {
        code: 1,
        brand: 1,
        brandSlug: 1,
        discount: 1,
        description: 1,
        upvotes: 1,
        totalVotes: 1,
        successRate: { $multiply: ['$successRate', 100] },
        link: 1,
      },
    },
  ]);

  return NextResponse.json({ codes: hot });
}
