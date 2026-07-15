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

const KEYWORDS = [
  'coupon', 'promo code', 'promo', 'discount', 'deal', 'offer',
  'save', 'sale', 'voucher', 'referral', 'refer', 'bonus',
  'free trial', 'free shipping', 'student', 'first order',
];

// Regex patterns for actual coupon codes
const CODE_PATTERNS = [
  /\b[A-Z0-9]{4,20}\b/g,              // SAVE20, WELCOME10, FREESHIP
  /(?:code|coupon|promo)[:\s]+([A-Z0-9]{4,20})/gi,
  /(?:use|enter|apply)\s+code[:\s]+([A-Z0-9]{4,20})/gi,
];

// Discount extraction patterns
const DISCOUNT_PATTERNS = [
  /(\d+%)\s*off/i,
  /\$(\d+)\s*off/i,
  /save\s+\$?(\d+|up\s+to\s+\d+%)/i,
  /free\s+(trial|shipping|delivery)/i,
  /up\s+to\s+(\d+%)/i,
  /(\d+%)\s+discount/i,
];

const UAs = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0',
];

function ua() { return UAs[Math.floor(Math.random() * UAs.length)]; }

function extractCodes(text) {
  const found = new Set();
  for (const pattern of CODE_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const m of matches) {
      const code = (m[1] || m[0]).trim();
      if (code.length >= 4 && code.length <= 20 && /[A-Z0-9]{4,}/i.test(code)) {
        found.add(code.toUpperCase());
      }
    }
  }
  return [...found];
}

function extractDiscount(text) {
  for (const pattern of DISCOUNT_PATTERNS) {
    const m = text.match(pattern);
    if (m) return m[0];
  }
  return null;
}

function extractTitle($) {
  const h1 = $('h1').first().text().trim();
  if (h1 && h1.length > 5 && h1.length < 200) return h1;
  const title = $('title').text().trim();
  if (title) return title;
  return null;
}

export async function discoverByUrlPatterns(brand) {
  const { brandName, website } = brand;
  const base = website.replace(/\/$/, '');
  const results = [];

  for (const pattern of PATTERNS) {
    const url = `${base}${pattern}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': ua() },
        redirect: 'follow',
        follow: 3,
        timeout: 8000,
      });
      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);
      const text = $('body').text().toLowerCase();

      const matched = KEYWORDS.filter(kw => text.includes(kw));
      if (matched.length < 2 && !text.match(/[A-Z0-9]{4,20}/)) continue;

      // Check normalized URL for dedup
      const norm = url.replace(/\/$/, '').toLowerCase();
      if (results.some(r => r.sourceUrl.replace(/\/$/, '').toLowerCase() === norm)) continue;

      const title = extractTitle($) || `${brandName} ${pattern}`;
      const codes = extractCodes(text);
      const discount = extractDiscount(text);

      // Boost confidence if we found actual codes
      let confidence = Math.min(50 + matched.length * 8, 98);
      if (codes.length > 0) confidence = Math.min(confidence + 15, 99);
      if (discount) confidence = Math.min(confidence + 5, 99);

      results.push({
        sourceUrl: url,
        sourcePage: pattern,
        sourceReliability: codes.length > 0 ? 'Official Site' : 'Official Site',
        confidence,
        title: title.slice(0, 200),
        description: ($('meta[name="description"]').attr('content') || '').slice(0, 500),
        discount: discount || 'Special offer',
        codes: [...new Set(codes)],
      });
    } catch {
      // Timeout or network error — skip silently
    }
  }

  return results;
}
