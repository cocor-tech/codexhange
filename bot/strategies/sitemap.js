import fetch from 'node-fetch';

const DEAL_KEYWORDS = ['coupon', 'promo', 'discount', 'deal', 'offer', 'sale', 'voucher', 'referral'];

function randomUA() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

export async function discoverBySitemap(brand) {
  const { brandName, website } = brand;
  const baseUrl = website.replace(/\/$/, '');

  const sitemapUrls = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap/sitemap.xml'];

  for (const sitemapPath of sitemapUrls) {
    try {
      const res = await fetch(`${baseUrl}${sitemapPath}`, {
        headers: { 'User-Agent': randomUA() },
        timeout: 10000,
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);

      const dealPages = urls.filter(url =>
        DEAL_KEYWORDS.some(kw => url.toLowerCase().includes(kw))
      );

      if (dealPages.length > 0) {
        return dealPages.slice(0, 20).map(url => ({
          sourceUrl: url,
          sourcePage: 'sitemap',
          sourceReliability: 'Official Site',
          confidence: 70,
          title: `Deal page found via sitemap`,
          description: `Found ${dealPages.length} deal-related pages in sitemap`,
          discount: 'Check page for details',
          matchedKeywords: 1,
          codes: [],
        }));
      }
    } catch {
      continue;
    }
  }

  return [];
}
