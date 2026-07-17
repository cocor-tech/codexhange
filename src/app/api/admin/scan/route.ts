import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  const botDir = path.join(process.cwd(), 'bot');
  const scriptPath = path.join(botDir, 'scan_single.py');
  const env = { ...process.env };

  try {
    const output = execSync(`python "${scriptPath}" "${url}"`, {
      cwd: botDir,
      env,
      timeout: 25000,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });

    const result = JSON.parse(output);
    return NextResponse.json(result);
  } catch (err: any) {
    // Try to parse partial output from stderr
    let partial = null;
    if (err.stdout) {
      try { partial = JSON.parse(err.stdout); } catch {}
    }
    return NextResponse.json({
      error: err.message?.slice(0, 200) || 'Scan failed',
      url,
      success: false,
      ...(partial || {}),
    }, { status: 500 });
  }
}
