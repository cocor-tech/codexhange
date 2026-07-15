import 'dotenv/config';
import { connect, close } from './db.js';
import { discoverByUrlPatterns } from './strategies/urlPatterns.js';
import { discoverBySitemap } from './strategies/sitemap.js';
import pLimit from 'p-limit';

const LIMIT = parseInt(process.env.CONCURRENCY || '5');
const limit = pLimit(LIMIT);

async function getServiceId(db, brandId) {
  const service = await db.collection('services').findOne({ brandId: brandId.toString() });
  return service?._id?.toString() || null;
}

async function processBrand(db, brand) {
  const id = brand._id.toString();
  const serviceId = await getServiceId(db, id);
  if (!serviceId) {
    console.log(`  ⚠ No service for ${brand.name} — run seed first`);
    return { brand: brand.name, offers: 0, error: 'no_service' };
  }

  const [patterns, sitemap] = await Promise.all([
    discoverByUrlPatterns({ brandId: id, brandName: brand.name, website: brand.website }),
    discoverBySitemap({ brandId: id, brandName: brand.name, website: brand.website }),
  ]);

  const seen = new Set();
  const results = [...patterns, ...sitemap].filter(r => {
    const k = r.sourceUrl.replace(/\/$/, '').toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let submitted = 0;
  for (const r of results) {
    const exists = await db.collection('offers').findOne({
      sourceUrl: r.sourceUrl,
      serviceId,
    });
    if (exists) continue;

    const now = new Date();
    await db.collection('offers').insertOne({
      serviceId,
      type: r.codes?.length > 0 ? 'promo_code' : 'coupon',
      title: r.title,
      code: r.codes?.[0] || null,
      discount: r.discount,
      description: r.description || '',
      sourceUrl: r.sourceUrl,
      sourcePage: r.sourcePage || '',
      sourceReliability: 'Official Site',
      countries: ['US'],
      confidence: r.codes?.length > 0 ? Math.min(r.confidence + 10, 98) : r.confidence,
      status: r.confidence >= 80 ? 'pending_review' : 'discovered',
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

  return { brand: brand.name, offers: results.length, submitted };
}

export async function discoverAllBrands({ maxBrands } = {}) {
  const db = await connect();
  const filter = { active: true };
  const brands = await db.collection('brands')
    .find(filter)
    .sort({ name: 1 })
    .limit(maxBrands || 1000)
    .toArray();

  console.log(`\n=== Discovering ${brands.length} brands ===\n`);

  const tasks = brands.map(b => limit(() => processBrand(db, b)));
  const results = await Promise.allSettled(tasks);

  let total = 0;
  let errors = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const d = r.value;
      if (d.error) errors++;
      else total += d.submitted;
      console.log(`  ${d.brand}: ${d.submitted}/${d.offers}`);
    } else {
      errors++;
      console.error(`  Error: ${r.reason?.message || r.reason}`);
    }
  }

  console.log(`\nDone. ${total} offers discovered across ${brands.length} brands (${errors} errors).`);
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

  const { brandId, brandName } = job;
  console.log(`Processing queued: ${brandName || brandId}`);

  const brand = await db.collection('brands').findOne({ _id: new (await import('mongodb')).ObjectId(brandId) });
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

  console.log(`Done: ${result.submitted} offers.`);
  await close();
}

// CLI
const args = process.argv.slice(2);
if (args.includes('--queue')) {
  processQueue();
} else if (args.includes('--brands')) {
  const max = args.includes('--max') ? parseInt(args[args.indexOf('--max') + 1]) : undefined;
  discoverAllBrands({ maxBrands: max });
} else {
  console.log(`
Usage:
  node standalone.js --brands              Discover all active brands
  node standalone.js --brands --max 10     Discover first 10 brands
  node standalone.js --queue               Process 1 queued job
`);
}
