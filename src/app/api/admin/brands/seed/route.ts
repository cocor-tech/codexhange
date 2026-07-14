import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Brand from '@/lib/models/Brand';
import { domainRegistrars } from '@/lib/data/domainRegistrars';

export const dynamic = 'force-dynamic';

export async function POST() {
  await connectDB();

  let created = 0;
  let skipped = 0;

  for (const reg of domainRegistrars) {
    const existing = await Brand.findOne({ name: reg.name });
    if (existing) {
      skipped++;
      continue;
    }

    await Brand.create({
      ...reg,
      category: 'Domain Names & Domain Registrars',
      country: 'US',
      hasPromoCodes: true,
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
      extensions: ['.com', '.net', '.org', '.ai', '.io', '.dev', '.app', '.xyz', '.co', '.me'],
    });

    created++;
  }

  const total = await Brand.countDocuments({ category: 'Domain Names & Domain Registrars' });

  return NextResponse.json({ created, skipped, total });
}
