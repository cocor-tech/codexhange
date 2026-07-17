import { connectDB } from '@/lib/mongoose';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  blockMs?: number;
}

const defaults = {
  ip: { windowMs: 60 * 1000, max: 5, blockMs: 60 * 60 * 1000 },
  account: { windowMs: 60 * 60 * 1000, max: 3, blockMs: 60 * 60 * 1000 },
};

async function getCollection() {
  const mongoose = await connectDB();
  return mongoose.connection.collection('rateLimits') as any;
}

export async function initRateLimitIndex() {
  const col = await getCollection();
  await col.createIndex({ updatedAt: 1 }, { expireAfterSeconds: 86400 });
}

export async function checkIpRate(key: string, config?: Partial<RateLimitConfig>) {
  const { windowMs, max, blockMs } = { ...defaults.ip, ...config };
  const col = await getCollection();
  const now = Date.now();

  const existing = await col.findOne({ _id: `ip:${key}` });
  if (existing?.blockedUntil && existing.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((existing.blockedUntil - now) / 1000) };
  }

  const cutoff = now - windowMs;
  await col.deleteMany({ _id: { $regex: `^ip:${key}:` }, timestamp: { $lt: cutoff } });

  const count = await col.countDocuments({ _id: { $regex: `^ip:${key}:` }, timestamp: { $gt: cutoff } });
  if (count >= max) {
    if (blockMs) {
      await col.updateOne(
        { _id: `ip:${key}` },
        { $set: { blockedUntil: now + blockMs, updatedAt: now } },
        { upsert: true }
      );
    }
    return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) };
  }

  await col.insertOne({ _id: `ip:${key}:${now}`, timestamp: now, updatedAt: now });
  return { allowed: true, remaining: max - count - 1 };
}

export async function checkAccountRate(key: string, config?: Partial<RateLimitConfig>) {
  const { max, blockMs } = { ...defaults.account, ...config };
  const col = await getCollection();
  const now = Date.now();

  const record = await col.findOne({ _id: `account:${key}` });
  if (!record) return { allowed: true, remaining: max, failures: 0 };

  if (record.blockedUntil && record.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((record.blockedUntil - now) / 1000) };
  }

  if (record.failures >= max) {
    if (record.blockedUntil && record.blockedUntil <= now) {
      await col.deleteOne({ _id: `account:${key}` });
      return { allowed: true, remaining: max, failures: 0 };
    }
    const until = now + (blockMs || defaults.account.blockMs);
    await col.updateOne(
      { _id: `account:${key}` },
      { $set: { failures: record.failures, blockedUntil: until, updatedAt: now } },
      { upsert: true }
    );
    return { allowed: false, retryAfter: Math.ceil((until - now) / 1000) };
  }

  return { allowed: true, remaining: Math.max(0, max - record.failures), failures: record.failures };
}

export async function recordFailure(key: string) {
  const col = await getCollection();
  const now = Date.now();

  await col.updateOne(
    { _id: `account:${key}` },
    {
      $inc: { failures: 1 },
      $set: { updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  return checkAccountRate(key);
}

export async function clearAccountRate(key: string) {
  const col = await getCollection();
  await col.deleteOne({ _id: `account:${key}` });
}
