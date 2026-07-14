import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import Code from '@/lib/models/Code';

export const dynamic = 'force-dynamic';

const DUSTBIN_THRESHOLD = 5;
const DUSTBIN_RATIO = 0.3;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { vote } = await req.json();
  if (vote !== 'up' && vote !== 'down') {
    return NextResponse.json({ error: 'Invalid vote' }, { status: 400 });
  }

  await connectDB();

  const code = await Code.findById(params.id);
  if (!code) {
    return NextResponse.json({ error: 'Code not found' }, { status: 404 });
  }

  if (vote === 'up') {
    code.upvotes += 1;
  } else {
    code.downvotes += 1;
  }

  const totalVotes = code.upvotes + code.downvotes;
  const successRate = totalVotes > 0 ? code.upvotes / totalVotes : 1;

  if (
    code.downvotes >= DUSTBIN_THRESHOLD &&
    successRate < DUSTBIN_RATIO &&
    !code.archived
  ) {
    code.archived = true;
    code.archivedAt = new Date();
  }

  await code.save();

  return NextResponse.json({ code });
}
