import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { brandId } = await req.json();
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 });

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }

  const db = mongoose.connection.db;
  if (!db) return NextResponse.json({ error: 'DB not connected' }, { status: 500 });

  await db.collection('discoveryQueue').insertOne({
    brandId,
    status: 'queued',
    createdAt: new Date(),
  });

  return NextResponse.json({ queued: true });
}
