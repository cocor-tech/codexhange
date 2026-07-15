import 'dotenv/config';
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

const args = process.argv.slice(2);
if (args.includes('--discover')) {
  discoverAll();
} else if (args.includes('--brand')) {
  const id = args[args.indexOf('--id') + 1];
  const name = args[args.indexOf('--name') + 1];
  const url = args[args.indexOf('--url') + 1];
  if (id && name && url) {
    addDiscoveryJob(id, name, url).then(() => process.exit(0));
  } else {
    console.error('Missing --id, --name, or --url');
    process.exit(1);
  }
} else {
  console.log(`
Usage:
  node index.js --discover                    Queue all active brands
  node index.js --brand --id <id> --name <n> --url <u>  Queue single brand
  node workers/discovery.js                   Start discovery worker
  node workers/verify.js                      Start verification worker
`);
  process.exit(1);
}
