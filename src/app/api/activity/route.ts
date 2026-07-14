import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';
import User from '@/lib/models/User';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connectDB();

  const entries = await Code.find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .select('submittedBy brand createdAt')
    .lean();

  const userIds = [...new Set(entries.map((e: any) => e.submittedBy?.toString()).filter(Boolean))];
  const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
  const userMap = Object.fromEntries(users.map((u: any) => [u._id.toString(), u.name || u.email?.split('@')[0] || 'Anonymous']));

  const feed = entries.map((e: any) => ({
    user: userMap[e.submittedBy?.toString()] || 'Anonymous',
    action: `submitted a code for ${e.brand}`,
    time: e.createdAt,
  }));

  return NextResponse.json({ feed });
}
