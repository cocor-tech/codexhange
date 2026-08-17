import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Brand from '@/lib/models/Brand';
import Website from '@/lib/models/Website';
import Offer from '@/lib/models/Offer';
import { requireAdmin } from '@/lib/requireAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  await connectDB();

  const brandDocs = await Brand.find({}, { _id: 1, name: 1 }).lean();
  const brandIds = brandDocs.map(b => b._id);
  const brandNames = brandDocs.map(b => b.name);

  const websiteDocs = await Website.find({ kind: { $ne: 'source' } }, { _id: 1 }).lean();
  const websiteIds = websiteDocs.map(w => w._id);

  const offersDeleted = await Offer.deleteMany({
    $or: [{ websiteId: { $in: websiteIds } }, { store_name: { $in: brandNames } }],
  });
  const websitesDeleted = await Website.deleteMany({ kind: { $ne: 'source' } });
  const brandsDeleted = await Brand.deleteMany({});

  return NextResponse.json({
    brandsDeleted: brandsDeleted.deletedCount,
    websitesDeleted: websitesDeleted.deletedCount,
    offersDeleted: offersDeleted.deletedCount,
  });
}