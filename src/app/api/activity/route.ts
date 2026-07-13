import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import FuelLedger from '@/lib/models/FuelLedger';
import User from '@/lib/models/User';

export async function GET() {
  await connectDB();

  const entries = await FuelLedger.find({ reason: { $in: ['vote', 'submission'] } })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const userIds = [...new Set(entries.map((e: any) => e.userId.toString()))];
  const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
  const userMap = Object.fromEntries(users.map((u: any) => [u._id.toString(), u.name || u.email?.split('@')[0] || 'Anonymous']));

  const feed = entries.map((e: any) => ({
    user: userMap[e.userId.toString()] || 'Anonymous',
    action: e.reason === 'vote' ? 'voted on a promo code' : 'submitted a new code',
    fuel: e.amount,
    type: e.type,
    time: e.createdAt,
  }));

  return NextResponse.json({ feed });
}
