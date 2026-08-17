import { NextRequest, NextResponse } from 'next/server';
import { getSession, clearSession, normalizeEmail } from '@/lib/adminAuth';
import { checkIpRate, checkAccountRate } from '@/lib/rateLimiter';

export const dynamic = 'force-dynamic';

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || process.env.ADMIN_SEED_EMAIL || '';
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const ipLimit = await checkIpRate(`session:${ip}`, { windowMs: 60 * 1000, max: 30 });
  if (!ipLimit.allowed) {
    return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
  }

  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  // Always check lock status for configured admin emails
  for (const adminEmail of getAdminEmails()) {
    const lock = await checkAccountRate(adminEmail);
    if (!lock.allowed) {
      return NextResponse.json({ ok: false, authenticated: false, locked: true, retryAfter: lock.retryAfter });
    }
  }

  if (!token) {
    return NextResponse.json({ ok: false, authenticated: false });
  }

  const session = await getSession(token);
  if (!session) {
    return NextResponse.json({ ok: false, authenticated: false });
  }

  return NextResponse.json({ ok: true, authenticated: true, email: session.email });
}

export async function DELETE(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (token) clearSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_session', '', { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 0 });
  return res;
}
