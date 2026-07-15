import { addBatchDiscovery, addDiscoveryJob } from './queue.js';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

async function fetchBrands(page = 1) {
  const res = await fetch(`${API_BASE}/api/admin/brands?limit=100&page=${page}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function discoverAll() {
  console.log('=== CodeXhange Discovery Bot ===');
  console.log(`API: ${API_BASE}`);

  let totalBrands = 0;
  let page = 1;

  while (true) {
    const data = await fetchBrands(page);
    const brands = data.brands || [];

    if (brands.length === 0) break;

    const active = brands.filter(b => b.active !== false && b.discovery?.enabled !== false);
    if (active.length > 0) {
      console.log(`Queueing ${active.length} brands from page ${page}...`);
      await addBatchDiscovery(active);
      totalBrands += active.length;
    }

    if (data.page >= data.pages) break;
    page++;
  }

  console.log(`Done. Queued ${totalBrands} brands for discovery.`);
  process.exit(0);
}

async function discoverSingle(brandId, brandName, website) {
  console.log(`Queuing single brand: ${brandName}`);
  await addDiscoveryJob(brandId, brandName, website);
  console.log('Done.');
  process.exit(0);
}

// CLI: node index.js              (discover all)
// CLI: node index.js <brandId> <name> <website>  (discover single)
const args = process.argv.slice(2);
if (args.length >= 3) {
  discoverSingle(args[0], args[1], args[2]);
} else {
  discoverAll();
}
