import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Brand from '@/lib/models/Brand';
import { allBrands } from '@/lib/data/brands';

export const dynamic = 'force-dynamic';

const defaultExtensions = ['.com', '.net', '.org', '.ai', '.io', '.dev', '.app', '.xyz', '.co', '.me'];

export async function POST() {
  await connectDB();

  let created = 0;
  let skipped = 0;

  for (const entry of allBrands) {
    const existing = await Brand.findOne({ name: entry.name, category: entry.category });
    if (existing) {
      skipped++;
      continue;
    }

    await Brand.create({
      name: entry.name,
      website: entry.website,
      category: entry.category,
      hasPromoCodes: true,
      hasReferralProgram: entry.hasReferralProgram,
      country: 'US',
      discounts: {
        firstYear: true,
        transfer: true,
        renewal: false,
        bundle: true,
        sslBundle: false,
        emailHosting: false,
        student: false,
        blackFriday: true,
        cyberMonday: true,
        newYear: true,
        anniversary: false,
        flashSale: true,
      },
      extensions: defaultExtensions,
    });

    created++;
  }

  return NextResponse.json({ created, skipped, total: created + skipped });
}
