import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/codexhange';

declare global {
  var mongooseConnection: typeof mongoose | undefined;
  var indexesInitialized: boolean | undefined;
}

let cached = global.mongooseConnection;

if (!cached) {
  cached = global.mongooseConnection = undefined;
}

async function ensureIndexes() {
  if (global.indexesInitialized) return;
  try {
    const [initRateLimitIndex, { ensureBlacklistIndex }] = await Promise.all([
      import('@/lib/rateLimiter').then(m => m.initRateLimitIndex()),
      import('@/lib/adminAuth'),
    ]);
    await ensureBlacklistIndex();
    global.indexesInitialized = true;
  } catch {}
}

export async function connectDB() {
  if (cached) return cached;
  const conn = await mongoose.connect(MONGODB_URI, {
    dbName: process.env.MONGODB_DB || 'codexhange',
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  cached = conn;
  ensureIndexes();
  return conn;
}
