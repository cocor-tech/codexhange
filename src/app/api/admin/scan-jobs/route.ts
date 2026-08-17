import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { connectDB } from '@/lib/mongoose';
import ScanJob from '@/lib/models/ScanJob';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  await connectDB();

  const filter: any = {};
  if (status) filter.status = status;

  const [jobs, total] = await Promise.all([
    ScanJob.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ScanJob.countDocuments(filter),
  ]);

  return NextResponse.json({ jobs, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { websiteId, url, source_type } = await req.json();
  if (!websiteId || !url) return NextResponse.json({ error: 'websiteId and url required' }, { status: 400 });

  await connectDB();

  const job = await ScanJob.create({
    websiteId,
    url,
    source_type: source_type || 'manual',
    status: 'queued',
  });

  return NextResponse.json({ job }, { status: 201 });
}
