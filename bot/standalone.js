import 'dotenv/config';
import { connect, close } from './db.js';
import { discoverByUrlPatterns } from './strategies/urlPatterns.js';
import { discoverBySitemap } from './strategies/sitemap.js';
import { scanHomepage } from './strategies/homepage.js';
import { searchDeals } from './strategies/searchDork.js';
import { discoverByLinks } from './strategies/linkDiscovery.js';
import { crawlBrand } from './strategies/crawler.js';
import pLimit from 'p-limit';

const LIMIT = parseInt(process.env.CONCURRENCY || '3');
const limit = pLimit(LIMIT);

const STRATEGIES = [
  { name: 'urlPatterns', fn: discoverByUrlPatterns },
  { name: 'sitemap', fn: discoverBySitemap },
  { name: 'homepage', fn: scanHomepage },
  { name: 'searchDork', fn: searchDeals },
  { name: 'linkDiscovery', fn: discoverByLinks },
  { name: 'crawler', fn: crawlBrand },
];

async function getServiceId(db, brandId) {
  const service = await db.collection('services').findOne(
    { brandId: brandId.toString() },
    { projection: { _id: 1 } }
  );
  return service?._id?.toString() || null;
}

async function processBrand(db, brand) {
  const id = brand._id.toString();
  const serviceId = await getServiceId(db, id);
  if (!serviceId) {
    return { brand: brand.name, offers: 0, error: 'no_service', details: 'Run seed first' };
  }

  const results = [];
  let totalFound = 0;

  for (const strategy of STRATEGIES) {
    try {
      // Rate limit between strategies (1s delay)
      if (results.length > 0) await new Promise(r => setTimeout(r, 1000));

      const discovered = await strategy.fn({
        brandId: id,
        brandName: brand.name,
        website: brand.website,
      });

      if (discovered.length > 0) {
        results.push(...discovered.map(d => ({ ...d, _strategy: strategy.name })));
        totalFound += discovered.length;
      }
    } catch (err) {
      console.error(`  [${strategy.name}] Error: ${err.message}`);
    }
  }

  // Dedup by URL
  const seenUrls = new Set();
  const unique = results.filter(r => {
    const key = r.sourceUrl.replace(/\/$/, '').toLowerCase();
    if (seenUrls.has(key)) return false;
    seenUrls.add(key);
    return true;
  });

  // Also dedup by code value
  const seenCodes = new Set();
  const finalResults = unique.filter(r => {
    const codeKey = r.codes?.length > 0 ? r.codes.join(',') : r.sourceUrl;
    if (seenCodes.has(codeKey)) return false;
    seenCodes.add(codeKey);
    return true;
  });

  // Check which already exist in DB to avoid re-submitting
  const existingUrls = new Set();
  const existingDocs = await db.collection('offers').find(
    { serviceId },
    { projection: { sourceUrl: 1 } }
  ).toArray();
  existingDocs.forEach(d => existingUrls.add(d.sourceUrl.replace(/\/$/, '').toLowerCase()));

  let submitted = 0;
  const now = new Date();

  for (const r of finalResults) {
    const urlKey = r.sourceUrl.replace(/\/$/, '').toLowerCase();
    if (existingUrls.has(urlKey)) continue;

    await db.collection('offers').insertOne({
      serviceId,
      type: r.codes?.length > 0 ? 'promo_code' : 'coupon',
      title: r.title?.slice(0, 200) || `${brand.name} offer`,
      code: r.codes?.[0] || null,
      discount: r.discount || 'Special offer',
      description: r.description?.slice(0, 500) || '',
      sourceUrl: r.sourceUrl,
      sourcePage: r.sourcePage || '',
      sourceReliability: 'Official Site',
      countries: brand.country && brand.country !== 'US' ? [brand.country] : [],
      confidence: Math.min(r.confidence || 50, 99),
      status: (r.confidence || 0) >= 80 ? 'pending_review' : 'discovered',
      verifiedBy: 'bot',
      verifiedAt: now,
      upvotes: 0,
      downvotes: 0,
      clicks: 0,
      createdAt: now,
      updatedAt: now,
    });
    submitted++;
  }

  // Update brand's lastChecked timestamp
  await db.collection('brands').updateOne(
    { _id: brand._id },
    { $set: { lastChecked: now } }
  );

  return {
    brand: brand.name,
    found: totalFound,
    unique: finalResults.length,
    submitted,
    strategies: STRATEGIES.map(s => s.name),
  };
}

export async function discoverAllBrands({ maxBrands, staleHours } = {}) {
  const db = await connect();

  const filter = { active: true };
  if (staleHours) {
    const cutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000);
    filter.$or = [
      { lastChecked: { $lt: cutoff } },
      { lastChecked: null },
    ];
  }

  const brands = await db.collection('brands')
    .find(filter)
    .sort({ lastChecked: 1, name: 1 })
    .limit(maxBrands || 500)
    .toArray();

  console.log(`\n=== Discovering ${brands.length} brands ===\n`);

  let totalSubmitted = 0;
  let totalFound = 0;
  let errors = 0;

  const tasks = brands.map(b => limit(async () => {
    const result = await processBrand(db, b);
    const status = result.error ? '⚠' : '✓';
    console.log(`  ${status} ${result.brand.padEnd(20)} found=${result.found} unique=${result.unique} submitted=${result.submitted}`);
    if (result.error) errors++;
    totalFound += result.found;
    totalSubmitted += result.submitted;
    return result;
  }));

  const settled = await Promise.allSettled(tasks);
  for (const r of settled) {
    if (r.status === 'rejected') {
      errors++;
      console.error(`  ✗ Error: ${r.reason?.message || r.reason}`);
    }
  }

  console.log(`\nDone. Found: ${totalFound}, Submitted: ${totalSubmitted}, Errors: ${errors}`);
  await close();
}

export async function processQueue() {
  const db = await connect();
  const queue = db.collection('discoveryQueue');

  const job = await queue.findOneAndUpdate(
    { status: 'queued' },
    { $set: { status: 'processing', startedAt: new Date() } },
    { sort: { createdAt: 1 } }
  );

  if (!job) {
    console.log('No queued jobs.');
    await close();
    return;
  }

  const { brandId } = job;
  console.log(`Processing queued: ${brandId}`);

  const { ObjectId } = await import('mongodb');
  const brand = await db.collection('brands').findOne({ _id: new ObjectId(brandId) });

  if (!brand) {
    await queue.updateOne({ _id: job._id }, { $set: { status: 'failed', error: 'Brand not found' } });
    await close();
    return;
  }

  const result = await processBrand(db, brand);
  await queue.updateOne(
    { _id: job._id },
    { $set: { status: 'done', result, completedAt: new Date() } }
  );

  console.log(`Done: ${result.submitted} offers submitted.`);
  await close();
}

// CLI
const args = process.argv.slice(2);
if (args.includes('--queue')) {
  processQueue();
} else if (args.includes('--stale')) {
  discoverAllBrands({ staleHours: 24 });
} else if (args.includes('--brands')) {
  const max = args.includes('--max') ? parseInt(args[args.indexOf('--max') + 1]) : undefined;
  discoverAllBrands({ maxBrands: max });
} else {
  console.log(`
Usage:
  node standalone.js --brands              Discover all active brands
  node standalone.js --brands --max 10     Discover first 10 brands
  node standalone.js --stale               Discover brands not checked in 24h
  node standalone.js --queue               Process 1 queued job
`);
}
