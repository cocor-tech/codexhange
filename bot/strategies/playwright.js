let playwright;
try {
  playwright = await import('playwright');
} catch {
  console.log('  Playwright not available, skipping JS strategy');
}

const PATTERNS = [
  '/coupons', '/promo', '/promo-codes', '/discount', '/deals',
  '/offers', '/special-offers', '/promotions', '/sale',
  '/coupon-codes', '/voucher', '/vouchers', '/promo-code',
  '/referral', '/referral-program', '/pricing', '/plans',
];

const CODE_PATTERNS = [
  /\b[A-Z0-9]{4,20}\b/g,
  /(?:code|coupon|promo)[:\s]+([A-Z0-9]{4,20})/gi,
  /(?:use|enter|apply)\s+code[:\s]+([A-Z0-9]{4,20})/gi,
];

function extractCodes(text) {
  const found = new Set();
  for (const p of CODE_PATTERNS) {
    for (const m of text.matchAll(p)) {
      const code = (m[1] || m[0]).trim();
      if (code.length >= 4 && code.length <= 20 && /[A-Z0-9]{4,}/i.test(code)) {
        found.add(code.toUpperCase());
      }
    }
  }
  return [...found];
}

const DISCOUNT_PATTERNS = [
  /(\d+%)\s*off/i, /\$(\d+)\s*off/i, /save\s+\$?(\d+)/i,
  /free\s+(trial|shipping|delivery)/i, /up\s+to\s+(\d+%)/i,
];

function extractDiscount(text) {
  for (const p of DISCOUNT_PATTERNS) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return null;
}

const KEYWORDS = [
  'coupon', 'promo code', 'promo', 'discount', 'deal', 'offer',
  'save', 'sale', 'voucher', 'referral', 'bonus', 'free trial',
];

export async function discoverWithPlaywright(brand) {
  if (!playwright) return [];

  const { brandName, website } = brand;
  const base = website.replace(/\/$/, '');
  const results = [];
  let browser;

  try {
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    });

    for (const pattern of PATTERNS) {
      const url = `${base}${pattern}`;
      try {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const text = await page.evaluate(() => document.body.innerText.toLowerCase());
        const title = await page.evaluate(() => {
          const h1 = document.querySelector('h1');
          return (h1?.innerText || document.title)?.trim() || '';
        });

        const matched = KEYWORDS.filter(kw => text.includes(kw));
        if (matched.length < 2) { await page.close(); continue; }

        const codes = extractCodes(text);
        const discount = extractDiscount(text);
        const desc = await page.evaluate(() =>
          document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
        );

        let confidence = Math.min(50 + matched.length * 8, 98);
        if (codes.length > 0) confidence = Math.min(confidence + 20, 99);
        if (discount) confidence = Math.min(confidence + 5, 99);

        results.push({
          sourceUrl: url,
          sourcePage: pattern,
          sourceReliability: 'Official Site',
          confidence,
          title: (title || `${brandName} ${pattern}`).slice(0, 200),
          description: desc.slice(0, 500),
          discount: discount || 'Special offer',
          codes: [...new Set(codes)],
        });

        await page.close();
      } catch {
        // Skip pages that fail to load
      }
    }
  } catch (err) {
    console.error('  Playwright error:', err.message);
  } finally {
    if (browser) await browser.close();
  }

  return results;
}
