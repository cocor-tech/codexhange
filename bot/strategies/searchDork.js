import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const QUERIES = [
  'coupon', 'promo code', 'discount code', 'promo', 'deal',
  'special offer', 'voucher', 'referral', 'coupon code',
  'promotion', 'sale', 'student discount',
];

export async function searchDeals(brand) {
  const { brandName, website } = brand;
  const domain = new URL(website).hostname.replace('www.', '');
  const results = [];

  // Try top 3 queries to avoid rate limiting
  const topQueries = QUERIES.slice(0, 3);

  for (const query of topQueries) {
    const searchUrl = `https://html.duckduckgo.com/html/?q=site:${domain}+${encodeURIComponent(query)}`;

    try {
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        },
        timeout: 10000,
      });
      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      let found = 0;
      $('.result__a').each((_, el) => {
        if (found >= 3) return;
        const link = $(el).attr('href') || '';
        const title = $(el).text().trim();

        // DuckDuckGo wraps links in redirect URLs, extract the actual URL
        const urlMatch = link.match(/uddg=(https?[^&]+)/);
        const actualUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : link;

        if (!actualUrl || actualUrl.includes('duckduckgo.com')) return;

        // Extract discount from title
        const pctMatch = title.match(/(\d+%)/);
        const dollarMatch = title.match(/\$(\d+)/);
        const freeMatch = title.match(/free/i);

        results.push({
          sourceUrl: actualUrl,
          sourcePage: 'search',
          sourceReliability: 'Official Site',
          confidence: 75,
          title: title.slice(0, 200),
          description: $(el).closest('.result').find('.result__snippet').text().trim().slice(0, 500),
          discount: pctMatch?.[0] || dollarMatch?.[0] || (freeMatch ? 'Free offer' : 'Special offer'),
          codes: [],
        });
        found++;
      });
    } catch {
      // Skip on error
    }
  }

  return results;
}
