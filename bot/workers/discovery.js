import 'dotenv/config';
import { createDiscoveryWorker } from '../queue.js';
import { discoverByUrlPatterns } from '../strategies/urlPatterns.js';
import { discoverBySitemap } from '../strategies/sitemap.js';
import fetch from 'node-fetch';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

async function getServiceId(brandId) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/services?brandId=${brandId}&limit=1`);
    if (res.ok) {
      const data = await res.json();
      if (data.services?.length > 0) return data.services[0]._id;
    }
  } catch {}
  return null;
}

async function submitOffer(offer) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(offer),
    });
    if (res.ok) return (await res.json()).offer;
    if (res.status === 409) return null;
    const text = await res.text();
    console.error(`  Submit ${res.status}: ${text.slice(0, 100)}`);
    return null;
  } catch (err) {
    console.error(`  Submit error:`, err.message);
    return null;
  }
}

const worker = createDiscoveryWorker(async (job) => {
  const { brandId, brandName, website } = job.data;
  console.log(`[Discovery] ${brandName} (${website})`);

  // Resolve serviceId for this brand
  const serviceId = await getServiceId(brandId);
  if (!serviceId) {
    console.error(`  No service found for brand ${brandId}. Run seed first.`);
    return { brandId, brandName, error: 'No service' };
  }

  const [patternResults, sitemapResults] = await Promise.all([
    discoverByUrlPatterns({ brandId, brandName, website }),
    discoverBySitemap({ brandId, brandName, website }),
  ]);

  const seen = new Set();
  const allResults = [...patternResults, ...sitemapResults].filter(r => {
    const key = r.sourceUrl;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`  URL patterns: ${patternResults.length}, Sitemap: ${sitemapResults.length}, Unique: ${allResults.length}`);

  let submitted = 0;
  for (const result of allResults) {
    const payload = {
      serviceId,
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
      payload.code = result.codes[0];
      payload.type = 'promo_code';
      payload.confidence = Math.min(result.confidence + 10, 98);
    }
    const created = await submitOffer(payload);
    if (created) submitted++;
  }

  console.log(`  Submitted ${submitted}/${allResults.length}`);
  return { brandId, brandName, discovered: allResults.length, submitted };
});

console.log('Discovery worker started. Waiting for jobs...');
