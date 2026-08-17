import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Website from '@/lib/models/Website';
import Url from '@/lib/models/Url';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const doc = await Website.findById(params.id).lean() as any;
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const mongoose = await connectDB();
  const db = mongoose.connection.db as any;
  const urls = await Url.find({ websiteId: params.id }).sort({ createdAt: 1 }).lean();
  const urlIds = urls.map(u => u._id);
  const offers = await db.collection('offers').countDocuments({ websiteId: params.id });
  const blocked = await db.collection('offers').countDocuments({ websiteId: params.id, status: 'blocked' });
  const logs = await db.collection('bot_logs').find({ brand_name: doc.name }).sort({ scanned_at: -1 }).limit(20).toArray();

  return NextResponse.json({ website: doc, urls, stats: { offers, blocked }, logs });
}