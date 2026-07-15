import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Brand from '@/lib/models/Brand';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authKey = req.headers.get('x-bot-api-key');
  if (authKey !== process.env.BOT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { brandId } = await req.json();

  await connectDB();

  if (brandId) {
    const brand = await Brand.findById(brandId);
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    return NextResponse.json({ brands: [brand] });
  }

  const brands = await Brand.find({ active: true, 'discovery.enabled': true }).lean();
  return NextResponse.json({ brands });
}
