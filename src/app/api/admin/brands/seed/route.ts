import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Brand from '@/lib/models/Brand';
import Category from '@/lib/models/Category';
import Service from '@/lib/models/Service';
import Website from '@/lib/models/Website';
import { requireAdmin } from '@/lib/requireAdmin';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  await connectDB();

  const totalBrands = await Brand.countDocuments({});
  const totalServices = await Service.countDocuments({});
  const totalCategories = await Category.countDocuments({});
  const totalWebsites = await Website.countDocuments({});

  return NextResponse.json({
    note: 'Brands are discovered by the bot from crawl sources. Seed list removed from source code.',
    totalBrands,
    totalServices,
    totalCategories,
    totalWebsites,
  });
}