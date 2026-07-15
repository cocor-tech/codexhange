import 'dotenv/config';
import { createVerificationWorker } from '../queue.js';
import fetch from 'node-fetch';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

const worker = createVerificationWorker(async (job) => {
  const { offerId } = job.data;
  console.log(`[Verify] ${offerId}`);

  // Fetch single offer
  let offer;
  try {
    const res = await fetch(`${API_BASE}/api/admin/offers?offerId=${offerId}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    offer = data.offers?.[0];
    if (!offer) throw new Error('Not found');
  } catch (err) {
    console.error(`  Fetch failed: ${err.message}`);
    return { offerId, status: 'not_found' };
  }

  // Check if source URL still exists
  let exists = false;
  try {
    const head = await fetch(offer.sourceUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' },
      timeout: 10000,
      redirect: 'follow',
    });
    exists = head.ok;
  } catch {
    exists = false;
  }

  let newStatus = offer.status;
  if (!exists && offer.status === 'published') newStatus = 'expired';
  else if (exists && offer.status === 'expired') newStatus = 'published';

  if (newStatus !== offer.status) {
    try {
      await fetch(`${API_BASE}/api/admin/offers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, status: newStatus, verifiedAt: new Date().toISOString() }),
      });
      console.log(`  ${offerId}: ${offer.status} → ${newStatus}`);
    } catch (err) {
      console.error(`  Update failed: ${err.message}`);
    }
  } else {
    // Still update verifiedAt to keep freshness
    try {
      await fetch(`${API_BASE}/api/admin/offers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, verifiedAt: new Date().toISOString() }),
      });
    } catch {}
    console.log(`  ${offerId}: unchanged (${offer.status}), verifiedAt refreshed`);
  }

  return { offerId, previousStatus: offer.status, newStatus };
});

console.log('Verification worker started. Waiting for jobs...');
