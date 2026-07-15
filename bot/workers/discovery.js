import { createDiscoveryWorker } from '../queue.js';
import { discoverByUrlPatterns } from '../strategies/urlPatterns.js';
import { discoverBySitemap } from '../strategies/sitemap.js';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

async function submitOffer(offer) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(offer),
    });
    if (res.ok) return (await res.json()).offer;
    if (res.status === 409) return null;
    console.error(`  Submit ${res.status}: ${offer.title}`);
    return null;
  } catch (err) {
    console.error(`  Submit error:`, err.message);
    return null;
  }
}

const worker = createDiscoveryWorker(async (job) => {
  const { brandId, brandName, website } = job.data;
  console.log(`[Discovery] ${brandName} (${website})`);

  const [patternResults, sitemapResults] = await Promise.all([
    discoverByUrlPatterns({ brandId, brandName, website }),
    discoverBySitemap({ brandId, brandName, website }),
  ]);

  const allResults = [...patternResults, ...sitemapResults];
  console.log(`  URL patterns: ${patternResults.length}, Sitemap: ${sitemapResults.length}`);

  let submitted = 0;
  for (const result of allResults) {
    const payload = {
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
      type: result.codes?.length > 0 ? 'promo_code' : 'coupon',
      code: result.codes?.[0],
    };
    if (result.codes?.length > 0) {
      payload.code = result.codes[0];
      payload.confidence = Math.min(result.confidence + 10, 98);
    }
    const created = await submitOffer(payload);
    if (created) submitted++;
  }

  console.log(`  Submitted ${submitted}/${allResults.length}`);
  return { brandId, brandName, discovered: allResults.length, submitted };
});

console.log('Discovery worker started. Waiting for jobs...');
