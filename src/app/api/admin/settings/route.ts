import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
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
    base_url: config?.base_url || '',
  });
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { provider, api_key, model, enabled, base_url } = await req.json();

  const validProviders = ['', 'gemini', 'openai', 'groq', 'huggingface'];
  if (!validProviders.includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  const mongoose = await connectDB();
  const db = mongoose.connection.db as any;

  const update: any = { $set: { provider, model: model || 'gemini-2.0-flash', enabled: !!enabled, base_url: base_url || '' } };
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
