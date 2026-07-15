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

const UAs = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0',
];

function ua() { return UAs[Math.floor(Math.random() * UAs.length)]; }

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
      if (matched.length < 2) continue;

      const title = ($('title').text().trim() || `${brandName} ${pattern}`).slice(0, 200);
      const desc = ($('meta[name="description"]').attr('content') || '').slice(0, 500);

      const codes = [];
      $('code, [class*="code"], [class*="coupon"]').each((_, el) => {
        const t = $(el).text().trim();
        if (t.length > 3 && t.length < 30 && /[A-Z0-9]{4,}/i.test(t)) codes.push(t);
      });

      const pct = text.match(/(\d+%)\s*off/i);
      const dollars = text.match(/\$(\d+)\s*off/i);

      // Duplicate check by normalized URL
      const norm = url.replace(/\/$/, '').toLowerCase();
      if (results.some(r => r.sourceUrl.replace(/\/$/, '').toLowerCase() === norm)) continue;

      results.push({
        sourceUrl: url,
        sourcePage: pattern,
        sourceReliability: 'Official Site',
        confidence: Math.min(50 + matched.length * 8, 98),
        title,
        description: desc,
        discount: pct?.[0] || dollars?.[0] || 'Special offer',
        codes: [...new Set(codes)],
      });
    } catch {
      // Timeout or network error — skip silently
    }
  }

  return results;
}
