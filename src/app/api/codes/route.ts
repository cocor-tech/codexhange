import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';
import { verifyFingerprint } from '@/lib/requireFingerprint';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const submitSchema = z.object({
  code: z.string().min(1).max(100),
  brand: z.string().min(1).max(100),
  brandSlug: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  discount: z.string().min(1).max(100),
  restrictions: z.string().max(200).optional(),
  expiresAt: z.string().optional(),
  link: z.string().url().optional(),
  affiliateLink: z.string().url().optional(),
  scope: z.enum(['global', 'local']).default('global'),
  country: z.string().max(2).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brandSlug = searchParams.get('brandSlug');
  const country = searchParams.get('country');
  const scope = searchParams.get('scope');

  await connectDB();

  const filter: any = { archived: false };
  if (brandSlug) filter.brandSlug = brandSlug;
  if (scope) {
    filter.scope = scope;
  } else if (country) {
    filter.$or = [{ scope: 'global' }, { country: country.toUpperCase() }];
  }

  const codes = await Code.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const fpOk = await verifyFingerprint(req, session.user.id);
  if (fpOk !== true) return fpOk;

  const body = await req.json();
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  await connectDB();

  const code = await Code.create({
    ...parsed.data,
    submittedBy: session.user.id,
  });

  return NextResponse.json({ code }, { status: 201 });
}
