import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { connectDB } from '@/lib/mongoose';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const mongoose = await connectDB();
  const db = mongoose.connection.db as any;
  const logs = await db.collection('bot_logs')
    .find({})
    .sort({ scanned_at: -1 })
    .limit(100)
    .toArray();

  return NextResponse.json({ logs });
}
