import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { connectDB } from '@/lib/mongoose';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { provider, api_key, model, base_url } = await req.json();

  const mongoose = await connectDB();
  const db = mongoose.connection.db as any;

  let key = api_key;
  if (!key || key.startsWith('••••')) {
    const saved = await db.collection('ai_config').findOne({ _id: 'global' });
    key = saved?.api_key || '';
  }
  if (!key) return NextResponse.json({ ok: false, message: 'No API key configured' });

  const name = provider || 'openai';
  let url = base_url || '';
  if (!url) {
    if (name === 'openrouter') url = 'https://openrouter.ai/api/v1';
    else if (name === 'groq') url = 'https://api.groq.com/openai/v1';
    else if (name === 'gemini') url = 'https://generativelanguage.googleapis.com/v1beta/openai';
    else url = 'https://api.openai.com/v1';
  }

  try {
    const res = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || (name === 'openrouter' ? 'nvidia/nemotron-3-ultra-550b-a55b:free' : 'gpt-4o-mini'),
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ ok: false, message: `HTTP ${res.status}: ${body.slice(0, 200)}` });
    }
    return NextResponse.json({ ok: true, message: 'OK' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: String(e?.message || e).slice(0, 200) });
  }
}