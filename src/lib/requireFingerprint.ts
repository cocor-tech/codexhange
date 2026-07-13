import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import User from '@/lib/models/User';

const MAX_DEVICES = 3;

export async function verifyFingerprint(req: NextRequest, userId: string): Promise<true | NextResponse> {
  const fp = req.headers.get('x-device-fingerprint');
  if (!fp || fp.length < 4) {
    return NextResponse.json({ error: 'Device fingerprint required' }, { status: 428 });
  }

  await connectDB();
  const user = await User.findById(userId).select('fingerprintHashes');

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const hashes: string[] = user.fingerprintHashes || [];

  if (hashes.includes(fp)) {
    return true;
  }

  if (hashes.length >= MAX_DEVICES) {
    return NextResponse.json({ error: 'Device limit reached. Remove a device from your account settings.' }, { status: 403 });
  }

  await User.findByIdAndUpdate(userId, { $push: { fingerprintHashes: fp } });

  return true;
}
