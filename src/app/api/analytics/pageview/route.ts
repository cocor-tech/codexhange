import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') || 'unknown';
    const ua = req.headers.get('user-agent') || 'unknown';
    
    // Device fingerprint: IP + UA hash
    const fingerprint = crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex');
    
    const mongoose = await connectDB();
    const db = mongoose.connection.db as any;
    const col = db.collection('pageviews');

    // Check if this device visited this path today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existing = await col.findOne({
      fingerprint,
      path,
      createdAt: { $gte: today, $lt: tomorrow },
    });

    if (!existing) {
      await col.insertOne({ fingerprint, path, createdAt: new Date() });
    }

    // TTL index auto-expires after 30 days
    try {
      await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
    } catch {}

    return NextResponse.json({ ok: true, unique: !existing });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
