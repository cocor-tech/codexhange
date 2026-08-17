import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  await connectDB();

  const filter: any = {};
  if (status === 'archived') filter.archived = true;
  else if (status === 'active') filter.archived = false;
  if (search) {
    filter.$or = [
      { brand: { $regex: search, $options: 'i' } },
      { brandSlug: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
    ];
  }

  const [codes, total] = await Promise.all([
    Code.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Code.countDocuments(filter),
  ]);

  return NextResponse.json({ codes, total, page, pages: Math.ceil(total / limit) });
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { codeId, action } = await req.json();
  if (!codeId || !['archive', 'unarchive'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  await connectDB();

  const update: any = {};
  if (action === 'archive') { update.archived = true; update.archivedAt = new Date(); }
  if (action === 'unarchive') { update.archived = false; update.archivedAt = null; }

  const code = await Code.findByIdAndUpdate(codeId, update, { new: true }).lean();
  if (!code) return NextResponse.json({ error: 'Code not found' }, { status: 404 });

  return NextResponse.json({ code });
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { codeId } = await req.json();
  if (!codeId) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  await connectDB();
  await Code.findByIdAndDelete(codeId);

  return NextResponse.json({ ok: true });
}
