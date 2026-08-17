import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/admin/:path*'],
};

function base64UrlToBytes(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function getSecretBytes(): Promise<Uint8Array> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret) return new TextEncoder().encode(secret);
  const raw = process.env.ADMIN_SEED_PASSWORD || 'fallback-secret';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return new Uint8Array(digest);
}

async function isValidAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const secretBytes = await getSecretBytes();
    const key = await crypto.subtle.importKey(
      'raw', secretBytes as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    const sigBytes = new Uint8Array(sigBuf);
    const expected = base64UrlToBytes(parts[2]);
    if (!timingSafeEqual(sigBytes, expected)) return false;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1])));
    if (payload.exp && payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The dashboard at /admin hosts the login form — always reachable.
  if (pathname === '/admin' || pathname === '/admin/') return NextResponse.next();

  const token = req.cookies.get('admin_session')?.value;
  const ok = await isValidAdminToken(token);
  if (ok) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/admin';
  loginUrl.search = '';
  return NextResponse.redirect(loginUrl);
}