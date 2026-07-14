import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongoose';
import User from '@/lib/models/User';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(session.user.id).select('fingerprintHashes');

  return NextResponse.json({
    deviceCount: user?.fingerprintHashes?.length || 0,
  });
}
