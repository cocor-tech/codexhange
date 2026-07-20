import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mongoose = await connectDB();
    const db = mongoose.connection.db as any;
    const progress = await db.collection('scan_progress').findOne({ _id: 'full_scan' });
    return NextResponse.json(progress || { status: 'idle', total: 0, done: 0, offers: 0 });
  } catch {
    return NextResponse.json({ status: 'error', total: 0, done: 0, offers: 0 });
  }
}
