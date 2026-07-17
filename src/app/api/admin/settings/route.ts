import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';

export const dynamic = 'force-dynamic';

export async function GET() {
  const mongoose = await connectDB();
  const db = mongoose.connection.db as any;
  const config = await db.collection('ai_config').findOne({ _id: 'global' });
  return NextResponse.json({
    provider: config?.provider || '',
    api_key: config?.api_key ? '••••••' : '',
    model: config?.model || '',
    enabled: config?.enabled || false,
  });
}

export async function POST(req: NextRequest) {
  const { provider, api_key, model, enabled } = await req.json();
  const mongoose = await connectDB();
  const db = mongoose.connection.db as any;

  const update: any = { $set: { provider, model, enabled } };
  if (api_key && !api_key.startsWith('••••')) {
    update.$set.api_key = api_key;
  }

  await db.collection('ai_config').updateOne(
    { _id: 'global' },
    update,
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
