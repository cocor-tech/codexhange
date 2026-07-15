import { Worker } from 'bullmq';
import { connection } from '../queue.js';
import { discoverByUrlPatterns } from '../strategies/urlPatterns.js';
import { discoverBySitemap } from '../strategies/sitemap.js';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.BOT_API_KEY || '';

async function submitOffer(offer) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/offers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-api-key': API_KEY,
        'x-verified-by': 'bot',
      },
      body: JSON.stringify(offer),
    });

    if (res.ok) {
      const data = await res.json();
      return data.offer;
    }

    if (res.status === 409) return null; // duplicate
    console.error(`  Submit failed (${res.status}): ${offer.title}`);
    return null;
  } catch (err) {
    console.error(`  Submit error:`, err.message);
    return null;
  }
}

const worker = new Worker('discovery', async (job) => {
  const { brandId, brandName, website } = job.data;
  console.log(`[Discovery] ${brandName} (${website})`);

  // Strategy 1: URL patterns
  const patternResults = await discoverByUrlPatterns({ brandId, brandName, website });
  console.log(`  URL patterns: ${patternResults.length} results`);

  // Strategy 2: Sitemap scanning
  const sitemapResults = await discoverBySitemap({ brandId, brandName, website });
  console.log(`  Sitemap: ${sitemapResults.length} results`);

  const allResults = [...patternResults, ...sitemapResults];

  let submitted = 0;
  for (const result of allResults) {
    const offerPayload = {
      serviceId: brandId,
      title: result.title,
      discount: result.discount,
      description: result.description || '',
      sourceUrl: result.sourceUrl,
      sourcePage: result.sourcePage,
      sourceReliability: result.sourceReliability,
      countries: ['US'],
      confidence: result.confidence,
      status: result.confidence >= 80 ? 'pending_review' : 'discovered',
      type: 'coupon',
    };

    if (result.codes?.length > 0) {
      offerPayload.code = result.codes[0];
      offerPayload.type = 'promo_code';
      offerPayload.confidence = Math.min(result.confidence + 10, 98);
    }

    const created = await submitOffer(offerPayload);
    if (created) submitted++;
  }

  console.log(`  Submitted: ${submitted}/${allResults.length}`);
  return { brandId, brandName, discovered: allResults.length, submitted };
}, {
  connection,
  concurrency: 3,
  lockDuration: 120000,
});

worker.on('completed', (job) => {
  console.log(`✓ ${job.data.brandName} done — ${job.returnvalue.submitted} submitted`);
});

worker.on('failed', (job, err) => {
  console.error(`✗ ${job?.data?.brandName || 'unknown'} failed:`, err.message);
});

console.log('Discovery worker started. Waiting for jobs...');
