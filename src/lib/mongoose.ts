import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/codexhange';

declare global {
  var mongooseConnection: typeof mongoose | undefined;
}

let cached = global.mongooseConnection;

if (!cached) {
  cached = global.mongooseConnection = undefined;
}

export async function connectDB() {
  if (cached) return cached;
  const conn = await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  cached = conn;
  return conn;
}
