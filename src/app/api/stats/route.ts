import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connectDB();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [activeCodes, archivedToday, totalBrands] = await Promise.all([
    Code.countDocuments({ archived: false }),
    Code.countDocuments({ archived: true, archivedAt: { $gte: today } }),
    Code.distinct('brandSlug', { archived: false }).then((b) => b.length),
  ]);

  return NextResponse.json({
    activeCodes,
    archivedToday,
    totalBrands,
  });
}
