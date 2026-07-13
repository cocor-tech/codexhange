import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongoose';
import FuelLedger from '@/lib/models/FuelLedger';
import User from '@/lib/models/User';
import { verifyFingerprint } from '@/lib/requireFingerprint';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const fpOk = await verifyFingerprint(req, session.user.id);
  if (fpOk !== true) return fpOk;

  await connectDB();
  const user = await User.findById(session.user.id).select('fuelBalance');
  const ledger = await FuelLedger.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return NextResponse.json({
    balance: user?.fuelBalance ?? 0,
    transactions: ledger,
  });
}
