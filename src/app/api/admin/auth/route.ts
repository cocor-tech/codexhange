import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import { createSession, ensureSeedAdmin, generateOtp, isAdminEmail, storeOtp, verifyOtp, verifyAdminPassword, setAdminPassword, ensureBlacklistIndex } from '@/lib/adminAuth';
import { checkIpRate, checkAccountRate, recordFailure, clearAccountRate } from '@/lib/rateLimiter';

export const dynamic = 'force-dynamic';

const ALLOWED_ACTIONS = ['login', 'verify', 'send', 'change-password'];

async function sendOtpEmail(email: string, otp: string) {
  const apiKey = process.env.BREVO_API_KEY || process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.EMAIL_FROM || 'noreply@codexhange.com';

  if (!apiKey) {
    return { ok: true, skipped: true, reason: 'mail-not-configured' };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { email: from, name: 'Codexhange Admin' },
        to: [{ email }],
        subject: 'Your Codexhange admin sign-in code',
        htmlContent: `<p>Your admin sign-in code is <strong>${otp}</strong>.</p><p>This code expires in 5 minutes.</p>`,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, skipped: false, error: text || 'brevo-request-failed' };
    }

    return { ok: true, skipped: false };
  } catch (error) {
    return { ok: false, skipped: false, error: error instanceof Error ? error.message : 'unknown' };
  }
}

function getClientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ipLimit = await checkIpRate(ip);
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfter) } });
  }

  const { email, otp, action, password, newPassword } = await req.json();

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  if (action === 'seed') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (action === 'login') {
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const accountLimit = await checkAccountRate(email);
    if (!accountLimit.allowed) {
      return NextResponse.json({ error: 'Account temporarily locked', locked: true, retryAfter: accountLimit.retryAfter }, { status: 429 });
    }

    await connectDB();
    await ensureSeedAdmin();
    await ensureBlacklistIndex();
    const result = await verifyAdminPassword(email, password);
    if (!result.ok) {
      const status = await recordFailure(email);
      return NextResponse.json({
        error: 'Invalid credentials',
        remainingAttempts: status.allowed ? status.remaining : 0,
        locked: !status.allowed,
        retryAfter: status.allowed ? undefined : status.retryAfter,
      }, { status: 401 });
    }

    await clearAccountRate(email);

    const otpCode = generateOtp();
    await storeOtp(email, otpCode);
    const mailResult = await sendOtpEmail(email, otpCode);

    return NextResponse.json({ ok: true, requiresOtp: true, message: mailResult.skipped ? 'OTP ready (mail not configured)' : 'OTP sent', devCode: otpCode });
  }

  if (action === 'change-password') {
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    await connectDB();
    await ensureSeedAdmin();
    const auth = await verifyAdminPassword(email, password);
    if (!auth.ok) {
      return NextResponse.json({ error: 'Invalid current password' }, { status: 401 });
    }
    await setAdminPassword(email, newPassword);
    return NextResponse.json({ ok: true, message: 'Password updated' });
  }

  if (action === 'send') {
    if (!isAdminEmail(email)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const otpCode = generateOtp();
    await storeOtp(email, otpCode);
    const mailResult = await sendOtpEmail(email, otpCode);

    return NextResponse.json({ ok: true, message: mailResult.skipped ? 'OTP ready (mail not configured)' : 'OTP sent', devCode: otpCode });
  }

  if (action === 'verify') {
    if (!otp || typeof otp !== 'string') {
      return NextResponse.json({ error: 'OTP is required' }, { status: 400 });
    }

    const valid = await verifyOtp(email, otp);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 });
    }

    const token = createSession(email);
    const res = NextResponse.json({ ok: true, token });
    res.cookies.set('admin_session', token, {
      httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 24 * 60 * 60,
    });
    return res;
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
