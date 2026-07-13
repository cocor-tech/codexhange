import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';
import User from '@/lib/models/User';
import FuelLedger from '@/lib/models/FuelLedger';
import { verifyFingerprint } from '@/lib/requireFingerprint';

const MICRO_BOOST_COST = 50;
const MEGA_BOOST_COST = 500;
const MICRO_CLICK_LIMIT = 15;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const fpOk = await verifyFingerprint(req, session.user.id);
  if (fpOk !== true) return fpOk;

  const { codeId, type } = await req.json();
  if (!codeId || !['micro', 'mega'].includes(type)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const cost = type === 'micro' ? MICRO_BOOST_COST : MEGA_BOOST_COST;

  await connectDB();

  const user = await User.findById(session.user.id);
  if (!user || user.fuelBalance < cost) {
    return NextResponse.json({ error: 'Insufficient Fuel' }, { status: 402 });
  }

  const code = await Code.findById(codeId);
  if (!code) {
    return NextResponse.json({ error: 'Code not found' }, { status: 404 });
  }

  const boostDuration = type === 'micro' ? 0 : 7 * 24 * 60 * 60 * 1000;

  user.fuelBalance -= cost;
  await user.save();

  code.boosted = true;
  code.boostClicksLimit = type === 'micro' ? MICRO_CLICK_LIMIT : 999999;
  if (type === 'mega') {
    code.boostedUntil = new Date(Date.now() + boostDuration);
  }
  await code.save();

  await FuelLedger.create({
    userId: session.user.id,
    amount: cost,
    type: 'spent',
    reason: 'boost',
    reference: code._id.toString(),
  });

  return NextResponse.json({ code, balance: user.fuelBalance });
}
