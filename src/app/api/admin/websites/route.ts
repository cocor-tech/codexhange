import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { connectDB } from '@/lib/mongoose';
import Website from '@/lib/models/Website';
import ScanJob from '@/lib/models/ScanJob';

const INITIAL_PATTERNS = [
  '/coupons', '/promo', '/promo-codes', '/discount', '/deals',
  '/offers', '/sale', '/free-trial',
];

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  await connectDB();

  const filter: any = {};
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { url: { $regex: search, $options: 'i' } },
      { 'brand.name': { $regex: search, $options: 'i' } },
    ];
  }

  const [websites, total] = await Promise.all([
    Website.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Website.countDocuments(filter),
  ]);

  return NextResponse.json({ websites, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { url } = await req.json();
  if (!url || typeof url !== 'string') return NextResponse.json({ error: 'Valid URL required' }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  await connectDB();

  const domain = parsed.hostname.replace('www.', '');
  const name = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
  const cleanUrl = parsed.origin;

  const existing = await Website.findOne({ url });
  if (existing) return NextResponse.json({ website: existing });

  const website = await Website.create({
    url: cleanUrl,
    domain,
    brand: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
    status: 'active',
  });

  const base = cleanUrl.replace(/\/$/, '');
  const jobs = INITIAL_PATTERNS.map(pattern => ({
    websiteId: website._id,
    url: `${base}${pattern}`,
    source_type: 'initial',
    status: 'queued',
    priority: 5,
  }));
  if (jobs.length > 0) await ScanJob.insertMany(jobs);

  return NextResponse.json({ website, jobs_created: jobs.length }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { websiteId, ...updates } = await req.json();
  if (!websiteId) return NextResponse.json({ error: 'websiteId required' }, { status: 400 });
  await connectDB();
  const website = await Website.findByIdAndUpdate(websiteId, updates, { new: true }).lean();
  return NextResponse.json({ website });
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { websiteId, deleteOffers } = await req.json();
  if (!websiteId) return NextResponse.json({ error: 'websiteId required' }, { status: 400 });
  await connectDB();
  await Website.findByIdAndDelete(websiteId);
  if (deleteOffers) {
    const mongoose = await connectDB();
    const db = mongoose.connection.db as any;
    await db.collection('offers').deleteMany({ store_slug: websiteId });
  }
  return NextResponse.json({ ok: true });
}
