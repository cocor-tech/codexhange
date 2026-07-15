import { Worker } from 'bullmq';
import { connection } from '../queue.js';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

async function checkOffer(offer) {
  try {
    const res = await fetch(offer.sourceUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
      redirect: 'follow',
    });

    return { exists: res.ok, statusCode: res.status, checkedAt: new Date().toISOString() };
  } catch {
    return { exists: false, statusCode: 0, checkedAt: new Date().toISOString() };
  }
}

const worker = new Worker('verification', async (job) => {
  const { offerId } = job.data;
  console.log(`[Verify] checking offer ${offerId}`);

  // Fetch the offer from the API
  let offer;
  try {
    const res = await fetch(`${API_BASE}/api/admin/offers?offerId=${offerId}`);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    offer = data.offers?.[0];
    if (!offer) throw new Error('No offer');
  } catch (err) {
    console.error(`  Could not fetch offer ${offerId}:`, err.message);
    return { offerId, status: 'not_found' };
  }

  const result = await checkOffer(offer);

  let newStatus = offer.status;
  if (!result.exists && offer.status === 'published') {
    newStatus = 'expired';
  } else if (result.exists && offer.status === 'expired') {
    newStatus = 'published';
  }

  if (newStatus !== offer.status) {
    try {
      await fetch(`${API_BASE}/api/admin/offers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, status: newStatus, verifiedAt: new Date().toISOString() }),
      });
      console.log(`  ${offer._id}: ${offer.status} → ${newStatus}`);
    } catch (err) {
      console.error(`  Update failed:`, err.message);
    }
  } else {
    console.log(`  ${offer._id}: unchanged (${offer.status})`);
  }

  return { offerId, previousStatus: offer.status, newStatus, result };
}, {
  connection,
  concurrency: 5,
  lockDuration: 60000,
});

worker.on('completed', (job) => {
  const r = job.returnvalue;
  if (r.previousStatus !== r.newStatus) {
    console.log(`✓ ${r.offerId}: ${r.previousStatus} → ${r.newStatus}`);
  }
});

worker.on('failed', (job, err) => {
  console.error(`✗ Verify ${job?.data?.offerId || '?'}:`, err.message);
});

console.log('Verification worker started. Waiting for jobs...');
