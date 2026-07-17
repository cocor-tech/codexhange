import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User, { IUser } from '@/lib/models/User';
import { connectDB } from '@/lib/mongoose';

type OtpRecord = {
  email: string;
  otp: string;
  expiresAt: number;
};

type FingerprintContext = {
  ip?: string;
  userAgent?: string;
  forwardedFor?: string;
};

const OTP_TTL_MS = 5 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

const otpStore = new Map<string, OtpRecord>();

function getJwtSecret(): string {
  return process.env.NEXTAUTH_SECRET || crypto.createHash('sha256').update(process.env.ADMIN_SEED_PASSWORD || 'fallback-secret').digest('hex');
}

function base64url(data: Buffer): string {
  return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Buffer {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function buildFingerprint({ ip, userAgent, forwardedFor }: FingerprintContext) {
  const raw = [ip || '', forwardedFor || '', userAgent || ''].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function pruneExpiredOtps() {
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (value.expiresAt <= now) otpStore.delete(key);
  }
}

export function generateOtp() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let otp = '';
  for (let i = 0; i < 6; i += 1) {
    otp += chars[Math.floor(Math.random() * chars.length)];
  }
  return otp;
}

export function storeOtp(email: string, otp: string) {
  const normalized = normalizeEmail(email);
  pruneExpiredOtps();
  otpStore.set(normalized, {
    email: normalized,
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
  });
  return otp;
}

export function verifyOtp(email: string, otp: string) {
  const normalized = normalizeEmail(email);
  pruneExpiredOtps();
  const record = otpStore.get(normalized);
  if (!record) return false;
  if (record.expiresAt <= Date.now()) {
    otpStore.delete(normalized);
    return false;
  }
  const isValid = record.otp === otp;
  if (isValid) otpStore.delete(normalized);
  return isValid;
}

function signJwt(payload: Record<string, any>): string {
  const secret = getJwtSecret();
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomBytes(16).toString('hex');
  const fullPayload = { ...payload, jti, iat: now, exp: now + 24 * 60 * 60 };
  const enc = (obj: any) => base64url(Buffer.from(JSON.stringify(obj)));
  const data = `${enc(header)}.${enc(fullPayload)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${base64url(sig)}`;
}

function verifyJwt(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const secret = getJwtSecret();
    const data = `${parts[0]}.${parts[1]}`;
    const sig = crypto.createHmac('sha256', secret).update(data).digest();
    const expected = base64url(sig);
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) return null;
    const payload = JSON.parse(base64urlDecode(parts[1]).toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function getBlacklistCollection() {
  const mongoose = await connectDB();
  return mongoose.connection.collection('tokenBlacklist') as any;
}

async function isTokenBlacklisted(token: string): Promise<boolean> {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const col = await getBlacklistCollection();
  const found = await col.findOne({ _id: hash });
  return !!found;
}

export async function blacklistToken(token: string) {
  const payload = verifyJwt(token);
  if (!payload?.exp) return;
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const col = await getBlacklistCollection();
  await col.updateOne(
    { _id: hash },
    { $set: { _id: hash, expiresAt: new Date(payload.exp * 1000), blacklistedAt: new Date() } },
    { upsert: true }
  );
}

export async function ensureBlacklistIndex() {
  const col = await getBlacklistCollection();
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

export function createSession(email: string) {
  return signJwt({ email: normalizeEmail(email) });
}

export async function getSession(token: string) {
  const blacklisted = await isTokenBlacklisted(token);
  if (blacklisted) return undefined;
  const payload = verifyJwt(token);
  if (!payload) return undefined;
  return { email: payload.email, expiresAt: payload.exp * 1000 };
}

export function clearSession(_token: string) {
}

export function clearSessionsForEmail(_email: string) {
}

export function isAdminEmail(email: string) {
  const normalized = normalizeEmail(email);
  const configured = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return configured.includes(normalized);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function ensureSeedAdmin() {
  const normalizedEmail = normalizeEmail(process.env.ADMIN_SEED_EMAIL || '');
  const password = process.env.ADMIN_SEED_PASSWORD || '';

  if (!normalizedEmail || !password) return false;

  const existing = await User.findOne({ email: normalizedEmail }).lean<IUser | null>();
  if (existing) {
    const current = existing as IUser & { passwordHash?: string };
    if (!current.passwordHash) {
      const hashed = await hashPassword(password);
      await User.updateOne({ _id: current._id }, { $set: { passwordHash: hashed } });
    }
    return true;
  }

  const hashed = await hashPassword(password);
  await User.create({
    email: normalizedEmail,
    name: 'Seed Admin',
    isAdmin: true,
    passwordHash: hashed,
  });

  return true;
}

export async function verifyAdminPassword(email: string, password: string) {
  const normalized = normalizeEmail(email);
  const user = await User.findOne({ email: normalized }).select('+passwordHash').lean<IUser | null>();
  if (!user?.passwordHash) {
    return { ok: false };
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { ok: false };
  }
  return { ok: true };
}

export async function setAdminPassword(email: string, newPassword: string) {
  const normalized = normalizeEmail(email);
  const hashed = await hashPassword(newPassword);
  await User.updateOne({ email: normalized }, { $set: { passwordHash: hashed } });
}

export { normalizeEmail };
