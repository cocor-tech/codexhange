import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongoose';
import User from '@/lib/models/User';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  await connectDB();
  const user = await User.findById(session.user.id).select('isAdmin');
  if (!user?.isAdmin) return null;
  return session;
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  await connectDB();

  const [users, total] = await Promise.all([
    User.find({})
      .select('name email fingerprintHashes isAdmin createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments({}),
  ]);

  return NextResponse.json({ users, total, page, pages: Math.ceil(total / limit) });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { userId, action } = await req.json();
  if (!userId || !['toggle-admin'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  await connectDB();

  const user = await User.findById(userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  user.isAdmin = !user.isAdmin;
  await user.save();
  return NextResponse.json({ isAdmin: user.isAdmin });
}
