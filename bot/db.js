import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI required');

let client = null;
let db = null;

export async function connect() {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  return db;
}

export async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
