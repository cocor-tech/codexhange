import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Source from '@/lib/models/Source';
import { requireAdmin } from '@/lib/requireAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');
  const status = searchParams.get('status');

  await connectDB();

  const filter: any = {};
  if (status) filter.status = status;

  const [sources, total] = await Promise.all([
    Source.find(filter).sort({ status: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Source.countDocuments(filter),
  ]);

  return NextResponse.json({ sources, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { name, url, type, frequency_hours, status, batch } = await req.json();

  await connectDB();

  if (Array.isArray(batch) && batch.length > 0) {
    let created = 0;
    let skipped = 0;
    for (const s of batch) {
      if (!s?.url) continue;
      try {
        const u = s.url.trim();
        const existing = await Source.findOne({ url: u });
        if (existing) { skipped++; continue; }
        await Source.create({
          name: (s.name || u.replace(/^https?:\/\//, '').replace(/^www\./, '')).trim(),
          url: u,
          type: s.type || 'promo',
          frequency_hours: s.frequency_hours || 6,
          status: s.status || 'active',
        });
        created++;
      } catch { skipped++; }
    }
    const total = await Source.countDocuments({});
    return NextResponse.json({ created, skipped, total }, { status: 201 });
  }

  if (!name || !url) return NextResponse.json({ error: 'name and url required' }, { status: 400 });

  try {
    const source = await Source.create({
      name,
      url: url.trim(),
      type: type || 'promo',
      frequency_hours: frequency_hours || 6,
      status: status || 'active',
    });
    return NextResponse.json({ source }, { status: 201 });
  } catch (err: any) {
    if (err?.code === 11000) return NextResponse.json({ error: 'Source already exists' }, { status: 409 });
    return NextResponse.json({ error: 'Failed to create source' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { sourceId, ...updates } = await req.json();
  if (!sourceId) return NextResponse.json({ error: 'sourceId required' }, { status: 400 });

  await connectDB();
  const source = await Source.findByIdAndUpdate(sourceId, updates, { new: true }).lean();
  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  return NextResponse.json({ source });
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { sourceId } = await req.json();
  if (!sourceId) return NextResponse.json({ error: 'sourceId required' }, { status: 400 });

  await connectDB();
  await Source.findByIdAndDelete(sourceId);
  return NextResponse.json({ ok: true });
}