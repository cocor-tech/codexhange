import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const DEAL_KEYWORDS = [
  'coupon', 'promo', 'discount', 'deal', 'offer', 'sale', 'save',
  'free', 'voucher', 'refer', 'reward', 'bonus', 'gift', 'special',
  'student', 'welcome', 'signup', 'subscribe', 'exclusive',
  'limited', 'flash', 'clearance', 'outlet', 'first', 'new customer',
  'referral', 'invite', 'loyalty', 'cashback', 'bundle', 'package',
  'price match', 'guarantee', 'wholesale', 'bulk', 'reseller',
  'affiliate', 'partner', 'membership', 'points', 'gift card',
  'egift', 'trial', 'freebie', 'giveaway', 'contest', 'sweepstakes',
  'black friday', 'cyber monday', 'holiday', 'christmas', 'summer',
  'spring', 'fall', 'seasonal', 'anniversary', 'birthday',
];

const UAs = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
];

function ua() { return UAs[Math.floor(Math.random() * UAs.length)]; }

export async function discoverByLinks(brand) {
  const { brandName, website } = brand;
  const baseUrl = website.replace(/\/$/, '');
  const results = [];

  try {
    const res = await fetch(baseUrl, {
      headers: { 'User-Agent': ua() },
      timeout: 10000,
      redirect: 'follow',
    });
    if (!res.ok) return results;

    const html = await res.text();
    const $ = cheerio.load(html);
    const foundUrls = new Set();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      // Only internal links
      let fullUrl;
      try {
        fullUrl = new URL(href, baseUrl).href;
        if (!fullUrl.startsWith(baseUrl) && !fullUrl.startsWith(baseUrl.replace('www.', ''))) return;
        if (fullUrl === baseUrl || fullUrl === baseUrl + '/') return;
      } catch { return; }

      const text = $(el).text().toLowerCase();
      const path = fullUrl.toLowerCase();
      const linkText = $(el).text().trim();

      // Check if link looks promotional
      const matchesKeyword = DEAL_KEYWORDS.some(kw =>
        text.includes(kw) || path.includes(encodeURIComponent(kw).toLowerCase()) || path.includes(kw.replace(/\s+/g, '-'))
      );

      const looksPromo = /\/[a-z]*\d+[a-z]*\//.test(path) || // /promo123
                         /percent|off|discount|save|price/i.test(path) ||
                         /coupon|promo|deal|offer|sale/i.test(path);

      if (!matchesKeyword && !looksPromo) return;

      // Skip common non-deal pages
      if (/login|signin|logout|register|cart|checkout|account|profile|order|shipping|contact|about|privacy|terms|returns/i.test(path) &&
          !DEAL_KEYWORDS.some(k => path.includes(k))) return;

      const norm = fullUrl.replace(/\/$/, '').toLowerCase();
      if (foundUrls.has(norm)) return;
      foundUrls.add(norm);

      // Determine confidence
      let confidence = 50;
      if (/coupon|promo|deal|offer|discount|sale/i.test(path)) confidence += 20;
      if (/free|save|percent|off|gift|reward/i.test(path)) confidence += 10;
      if (/\d+%|\$?\d+off/i.test(text)) confidence += 15;
      if (/(student|teacher|military|first|welcome|signup|new)/i.test(text)) confidence += 10;

      results.push({
        sourceUrl: fullUrl,
        sourcePage: 'link-discovery',
        sourceReliability: 'Official Site',
        confidence: Math.min(confidence, 95),
        title: linkText.slice(0, 200),
        description: $(el).closest('li, div, p').text().trim().slice(0, 300),
        discount: text.match(/(\d+%\s*off|\$\d+\s*off|free\s+\w+)/i)?.[0] || 'Special offer',
        codes: [],
      });
    });
  } catch {}

  // Sort by confidence, dedup by URL
  const seen = new Set();
  return results.sort((a, b) => b.confidence - a.confidence).filter(r => {
    const k = r.sourceUrl.replace(/\/$/, '').toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
