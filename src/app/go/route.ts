import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const ref = searchParams.get('ref');

  if (!url) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (ref) {
    try {
      await connectDB();
      await Code.updateMany({ brandSlug: ref, link: decodeURIComponent(url) }, { $inc: { clicks: 1 } });
    } catch {}
  }

  return NextResponse.redirect(decodeURIComponent(url));
}
