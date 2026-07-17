import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';

export const dynamic = 'force-dynamic';

export async function GET() {
  const mongoose = await connectDB();
  const db = mongoose.connection.db as any;
  const logs = await db.collection('bot_logs')
    .find({})
    .sort({ scanned_at: -1 })
    .limit(100)
    .toArray();

  return NextResponse.json({ logs });
}
