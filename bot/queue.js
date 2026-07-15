import { Queue, Worker, QueueScheduler } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

export const discoveryQueue = new Queue('discovery', { connection });
export const verificationQueue = new Queue('verification', { connection });

export async function addDiscoveryJob(brandId, brandName, website) {
  return discoveryQueue.add('discover', { brandId, brandName, website }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export async function addVerificationJob(offerId) {
  return verificationQueue.add('verify', { offerId }, {
    attempts: 2,
    backoff: { type: 'fixed', delay: 300000 },
    removeOnComplete: 100,
  });
}

export async function addBatchDiscovery(brands) {
  const jobs = brands.map(b => ({
    name: 'discover',
    data: { brandId: b._id.toString(), brandName: b.name, website: b.website },
    opts: { attempts: 3, backoff: { type: 'exponential', delay: 60000 } },
  }));
  return discoveryQueue.addBulk(jobs);
}

export { connection };
