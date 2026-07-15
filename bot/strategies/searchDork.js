import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const QUERIES = [
  'coupon', 'promo code', 'discount code', 'promo', 'deal',
  'special offer', 'voucher', 'referral', 'coupon code',
  'promotion', 'sale', 'student discount',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';

function extractMeta(title, snippet) {
  const text = (title + ' ' + snippet).toLowerCase();
  const pct = text.match(/(\d+%)\s*off/i);
  const dollar = text.match(/\$(\d+)\s*off/i);
  const free = text.match(/free\s+(trial|shipping|delivery)/i);
  return {
    discount: pct?.[0] || dollar?.[0] || (free ? free[0] : null),
    hasCode: /\b[A-Z0-9]{4,}\b/.test(text),
  };
}

async function searchDuckDuckGo(domain, query) {
  const results = [];
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=site:${domain}+${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });
    if (!res.ok || res.status === 202) return results;

    const $ = cheerio.load(await res.text());
    $('.result__a').each((_, el) => {
      const link = $(el).attr('href') || '';
      const urlMatch = link.match(/uddg=(https?[^&]+)/);
      const url = urlMatch ? decodeURIComponent(urlMatch[1]) : link;
      if (!url || url.includes('duckduckgo.com')) return;

      const title = $(el).text().trim();
      const snippet = $(el).closest('.result').find('.result__snippet').text().trim();
      const meta = extractMeta(title, snippet);

      results.push({ title: title.slice(0, 200), snippet: snippet.slice(0, 300), url, meta });
    });
  } catch {}
  return results;
}

// Bing Search API (free: 1,000 calls/month, needs API key)
async function searchBingApi(domain, query) {
  const key = process.env.BING_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch(
      `https://api.bing.microsoft.com/v7.0/search?q=site:${domain}+${encodeURIComponent(query)}&count=5`,
      { headers: { 'Ocp-Apim-Subscription-Key': key }, timeout: 10000 }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.webPages?.value || []).map(r => ({
      title: (r.name || '').slice(0, 200),
      snippet: (r.snippet || '').slice(0, 300),
      url: r.url,
      meta: extractMeta(r.name || '', r.snippet || ''),
    }));
  } catch { return []; }
}

// Google Programmable Search API (free: 100 queries/day, needs API key + CX)
async function searchGoogleApi(domain, query) {
  const key = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;
  if (!key || !cx) return [];

  try {
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=site:${domain}+${encodeURIComponent(query)}`,
      { timeout: 10000 }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map(r => ({
      title: (r.title || '').slice(0, 200),
      snippet: (r.snippet || '').slice(0, 300),
      url: r.link,
      meta: extractMeta(r.title || '', r.snippet || ''),
    }));
  } catch { return []; }
}

export async function searchDeals(brand) {
  const { website } = brand;
  const domain = new URL(website).hostname.replace('www.', '');
  const topQueries = QUERIES.slice(0, 2);

  const allResults = [];
  const seen = new Set();

  for (const query of topQueries) {
    const engines = [searchDuckDuckGo(domain, query)];

    // Add API-based engines if configured
    if (process.env.BING_API_KEY) engines.push(searchBingApi(domain, query));
    if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CX) engines.push(searchGoogleApi(domain, query));

    const results = (await Promise.all(engines)).flat();

    for (const result of results) {
      const key = result.url.replace(/\/$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      allResults.push({
        sourceUrl: result.url,
        sourcePage: 'search',
        sourceReliability: 'Official Site',
        confidence: result.meta.hasCode ? 85 : 75,
        title: result.title,
        description: result.snippet,
        discount: result.meta.discount || 'Special offer',
        codes: [],
      });
    }
  }

  return allResults;
}
