import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const PATTERNS = [
  '/coupons', '/promo', '/promo-codes', '/discount', '/deals',
  '/offers', '/special-offers', '/promotions', '/sale',
  '/coupon-codes', '/voucher', '/vouchers', '/promo-code',
  '/student-discount', '/referral', '/referral-program',
  '/black-friday', '/cyber-monday', '/holiday-sale',
  '/pricing', '/plans', '/subscription',
];

const COUPON_KEYWORDS = [
  'coupon', 'promo code', 'promo', 'discount', 'deal', 'offer',
  'save', 'sale', 'voucher', 'referral', 'refer', 'bonus',
  'free trial', 'free shipping', 'student', 'first order',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function extractText($, selector) {
  const el = $(selector);
  return el.length ? el.text().trim() : null;
}

export async function discoverByUrlPatterns(brand) {
  const { brandId, brandName, website } = brand;
  const baseUrl = website.replace(/\/$/, '');
  const results = [];

  for (const pattern of PATTERNS) {
    const url = `${baseUrl}${pattern}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': randomUA() },
        redirect: 'follow',
        follow: 3,
        timeout: 10000,
      });

      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);
      const pageText = $('body').text().toLowerCase();

      const matchedKeywords = COUPON_KEYWORDS.filter(kw => pageText.includes(kw));
      if (matchedKeywords.length < 2) continue;

      const title = $('title').text().trim() || `${brandName} ${pattern}`;
      const metaDesc = $('meta[name="description"]').attr('content') || '';

      const offerTitles = [];
      $('h1, h2, h3').each((_, el) => {
        const text = $(el).text().trim();
        if (COUPON_KEYWORDS.some(kw => text.toLowerCase().includes(kw))) {
          offerTitles.push(text);
        }
      });

      const discountTexts = [];
      $('[class*="discount"], [class*="price"], [class*="sale"], [class*="offer"]').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 1 && text.length < 100) discountTexts.push(text);
      });

      const codes = [];
      $('code, [class*="code"], [class*="coupon"]').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 3 && text.length < 30 && /[A-Z0-9]{4,}/i.test(text)) {
          codes.push(text);
        }
      });

      const discountMatch = pageText.match(/(\d+%)/);
      const priceMatch = pageText.match(/\$(\d+)\s*off/i);

      results.push({
        sourceUrl: url,
        sourcePage: pattern,
        sourceReliability: 'Official Site',
        confidence: Math.min(50 + matchedKeywords.length * 8, 98),
        title: title.slice(0, 200),
        description: metaDesc.slice(0, 500),
        discount: discountMatch?.[1] || priceMatch?.[0] || 'Special offer',
        matchedKeywords: matchedKeywords.length,
        codes: [...new Set(codes)],
      });
    } catch {
      continue;
    }
  }

  return results;
}
