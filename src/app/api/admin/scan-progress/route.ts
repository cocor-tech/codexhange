import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(req: NextRequest) {
  const { action } = await req.json();
  try {
    const mongoose = await connectDB();
    const db = mongoose.connection.db as any;

    if (action === 'pause') {
      await db.collection('scan_progress').updateOne(
        { _id: 'full_scan' },
        { $set: { paused: true, status: 'paused' } },
        { upsert: true }
      );
      return NextResponse.json({ ok: true, status: 'paused' });
    }

    if (action === 'continue') {
      await db.collection('scan_progress').updateOne(
        { _id: 'full_scan' },
        { $set: { paused: false, status: 'running' } },
        { upsert: true }
      );
      return NextResponse.json({ ok: true, status: 'running' });
    }

    if (action === 'start') {
      await db.collection('scan_progress').updateOne(
        { _id: 'full_scan' },
        { $set: { paused: false, status: 'running', done: 0 } },
        { upsert: true }
      );
      return NextResponse.json({ ok: true, status: 'running' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
