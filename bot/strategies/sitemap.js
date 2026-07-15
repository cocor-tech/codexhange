import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const DEAL_KEYWORDS = ['coupon', 'promo', 'discount', 'deal', 'offer', 'sale', 'voucher', 'referral',
  'free', 'save', 'promos', 'special', 'student', 'pricing', 'plans'];

const UAs = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
];

function ua() { return UAs[Math.floor(Math.random() * UAs.length)]; }

async function fetchTitle(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': ua() },
      timeout: 5000,
      redirect: 'follow',
      follow: 2,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    const h1 = $('h1').first().text().trim();
    if (h1 && h1.length > 5 && h1.length < 150) return h1;
    const title = $('title').text().trim();
    return title || null;
  } catch {
    return null;
  }
}

function scoreUrl(url, keywordCount) {
  const path = url.toLowerCase();
  // Exact deal paths score higher
  if (path.match(/\/coupons?\/?$/)) return 95;
  if (path.match(/\/promo[cs]?\/?$/)) return 93;
  if (path.match(/\/deals?\/?$/)) return 90;
  if (path.match(/\/offers?\/?$/)) return 88;
  if (path.match(/\/sale\/?$/)) return 85;
  if (path.match(/\/discount\/?$/)) return 85;
  if (path.match(/\/referral\/?$/)) return 80;
  if (path.match(/\/pricing\/?$/)) return 75;
  if (path.match(/\/student\/?$/)) return 80;

  // Generic score based on keyword count
  const baseScore = 50 + keywordCount * 8;
  if (path.includes('transfer') || path.includes('save')) baseScore + 5;

  return Math.min(baseScore, 98);
}

export async function discoverBySitemap(brand) {
  const { brandName, website } = brand;
  const baseUrl = website.replace(/\/$/, '');

  const sitemapPaths = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap/sitemap.xml'];

  for (const sitemapPath of sitemapPaths) {
    try {
      const res = await fetch(`${baseUrl}${sitemapPath}`, {
        headers: { 'User-Agent': ua() },
        timeout: 10000,
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);

      const dealPages = urls.filter(url =>
        DEAL_KEYWORDS.some(kw => url.toLowerCase().includes(kw))
      );

      if (dealPages.length === 0) continue;

      // Fetch titles for the best pages (limit to 10)
      const topPages = dealPages.slice(0, 10);
      const results = [];

      for (const url of topPages) {
        const keywordCount = DEAL_KEYWORDS.filter(kw => url.toLowerCase().includes(kw)).length;
        const confidence = scoreUrl(url, keywordCount);

        let title = `${brandName} — ${url.split('/').pop()?.replace(/-/g, ' ') || 'Deal page'}`;
        title = title.replace(/\/$/, '');

        results.push({
          sourceUrl: url,
          sourcePage: 'sitemap',
          sourceReliability: 'Official Site',
          confidence,
          title,
          description: '',
          discount: 'Check page for details',
          codes: [],
        });
      }

      return results;
    } catch {
      continue;
    }
  }

  return [];
}
