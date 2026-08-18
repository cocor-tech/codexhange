import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { connectDB } from '@/lib/mongoose';
import ScanJob from '@/lib/models/ScanJob';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const GH_REPO = process.env.GH_REPO || 'cocor-tech/codexhange';
const GH_WORKFLOW = 'bot-discovery.yml';

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { websiteId, url, source_type, fullDiscovery } = await req.json().catch(() => ({}));

  const token = process.env.GH_PAT;
  if (!token) {
    return NextResponse.json({ error: 'GH_PAT not configured — add it to Vercel env vars' }, { status: 500 });
  }

  let job = null;
  if (websiteId && url) {
    await connectDB();
    job = await ScanJob.create({
      websiteId,
      url,
      source_type: source_type || 'manual',
      status: 'queued',
    });
  }

  const dispatch = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'codexhange-admin',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: { fullDiscovery: fullDiscovery ? 'true' : 'false' },
    }),
  });

  if (!dispatch.ok) {
    const body = await dispatch.text().catch(() => '');
    return NextResponse.json({
      job,
      error: `Failed to trigger GitHub bot: ${dispatch.status} ${body.slice(0, 200)}`,
    }, { status: 500 });
  }

  return NextResponse.json({
    job,
    triggered: true,
    runsUrl: `https://github.com/${GH_REPO}/actions`,
  }, { status: 201 });
}