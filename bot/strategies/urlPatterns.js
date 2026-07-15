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

// Detect actual coupon codes in text
const CODE_PATTERNS = [
  /(?:code|coupon|promo)[:\s]+([A-Z0-9_\-]{4,25})/gi,
  /(?:use|enter|apply)\s+(?:code\s+)?["']?([A-Z0-9_\-]{4,25})["']?/gi,
  /\b([A-Z0-9]{4,20})\b(?=.*(?:off|save|discount|free))/gi,
  /["']([A-Z0-9_\-]{4,25})["']/g,
];

const DISCOUNT_PATTERNS = [
  /(\d+%)\s*off/i, /\$(\d+)\s*off/i, /save\s+\$?(\d+|up\s+to\s+\d+%)/i,
  /free\s+(trial|shipping|delivery|domain)/i, /up\s+to\s+(\d+%)/i,
  /(\d+%)\s+discount/i, /just\s+\$?(\d+)\/(mo|month|year)/i,
  /starting at\s+\$?(\d+)/i, /was\s+\$?(\d+)\s+now\s+\$?(\d+)/i,
  /(\d+)-month\s+free/i, /get\s+(\d+)%\s+off/i,
];

const UAs = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
];

function ua() { return UAs[Math.floor(Math.random() * UAs.length)]; }

function extractCodes(text) {
  const found = new Set();
  for (const p of CODE_PATTERNS) {
    for (const m of text.matchAll(p)) {
      const code = (m[1] || m[0]).trim();
      if (code.length >= 4 && code.length <= 25 && /[A-Z0-9]{3,}/i.test(code)) {
        // Filter out false positives (numbers, dates, prices)
        if (/^\d+$/.test(code) && code.length < 6) continue;
        if (/^\d{2,4}$/.test(code)) continue;
        found.add(code.toUpperCase());
      }
    }
  }
  return [...found];
}

function extractDiscount(text) {
  for (const p of DISCOUNT_PATTERNS) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return null;
}

// Detect copy/reveal button elements
function findCopyButtons($) {
  const buttons = [];
  const selectors = [
    'button', '[class*="copy"]', '[class*="reveal"]', '[class*="show-code"]',
    '[class*="get-code"]', '[class*="claim"]', '[class*="grab"]',
  ];
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (/copy|reveal|show code|get code|claim|grab/i.test(text)) {
        buttons.push({ text: $(el).text().trim(), html: $.html(el) });
      }
    });
  }
  return buttons;
}

// Detect coupon/deal card elements
function findDealCards($) {
  const cards = [];
  $(`[class*="coupon"], [class*="deal"], [class*="offer"], [class*="promo"],
     [class*="discount"], [class*="voucher"], [class*="code"]`).each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 10 && text.length < 500) {
      cards.push({ text, html: $.html(el).slice(0, 300) });
    }
  });
  return cards;
}

// Extract JSON-LD structured data
function extractJsonLd($) {
  const offers = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const items = data['@graph'] || [data];
      for (const item of items) {
        if (item['@type'] === 'Offer' || item['@type']?.includes('Offer')) {
          offers.push({
            price: item.price,
            priceCurrency: item.priceCurrency,
            discount: item.eligibleDiscount?.discountAmount || item.priceSpecification?.price,
            description: item.description,
            url: item.url,
          });
        }
      }
    } catch {}
  });
  return offers;
}

function scoreConfidence($, text) {
  let score = 50;

  // Keyword matches
  const kwCount = KEYWORDS.filter(k => text.includes(k)).length;
  score += kwCount * 6;

  // Found actual codes
  if (extractCodes(text).length > 0) score += 20;

  // Found discount patterns
  if (extractDiscount(text)) score += 10;

  // Has deal cards
  if (findDealCards($).length > 0) score += 10;

  // Has copy buttons
  if (findCopyButtons($).length > 0) score += 15;

  // Has JSON-LD offers
  if (extractJsonLd($).length > 0) score += 10;

  // Title has deal keywords
  const title = $('title').text().toLowerCase();
  if (KEYWORDS.some(k => title.includes(k))) score += 10;

  return Math.min(score, 99);
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
      const text = $('body').text();

      // Must have at least 2 keywords OR actual codes
      const kwCount = KEYWORDS.filter(k => text.toLowerCase().includes(k)).length;
      if (kwCount < 2 && !extractCodes(text).length) continue;

      // Dedup
      const norm = url.replace(/\/$/, '').toLowerCase();
      if (results.some(r => r.sourceUrl.replace(/\/$/, '').toLowerCase() === norm)) continue;

      const codes = extractCodes(text);
      const discount = extractDiscount(text);
      const confidence = scoreConfidence($, text.toLowerCase());
      const title = $('h1').first().text().trim() || $('title').text().trim() || `${brandName} ${pattern}`;

      results.push({
        sourceUrl: url,
        sourcePage: pattern,
        sourceReliability: codes.length > 0 ? 'Official Site' : 'Official Site',
        confidence,
        title: title.slice(0, 200),
        description: ($('meta[name="description"]').attr('content') || '').slice(0, 500),
        discount: discount || 'Special offer',
        codes: [...new Set(codes)],
        hasCopyButtons: findCopyButtons($).length > 0,
        hasDealCards: findDealCards($).length > 0,
        jsonLdOffers: extractJsonLd($),
      });
    } catch {
      // Skip
    }
  }

  return results;
}
