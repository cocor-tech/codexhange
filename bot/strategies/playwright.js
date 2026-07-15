let playwright, stealth;
try {
  playwright = await import('playwright-extra');
  stealth = (await import('puppeteer-extra-plugin-stealth')).default();
  playwright.use(stealth);
} catch {
  try {
    playwright = await import('playwright');
  } catch {
    // Not available
  }
}

const PATTERNS = [
  '/coupons', '/promo', '/promo-codes', '/discount', '/deals',
  '/offers', '/special-offers', '/promotions', '/sale',
  '/coupon-codes', '/voucher', '/vouchers', '/promo-code',
  '/referral', '/referral-program', '/pricing', '/plans',
  '/student-discount', '/new-customer', '/welcome',
  '/signup-offer', '/m/login', '/m/referral',
];

const KEYWORDS = [
  'coupon', 'promo code', 'promo', 'discount', 'deal', 'offer',
  'save', 'sale', 'voucher', 'referral', 'bonus', 'free trial',
];

const CODE_PATTERNS = [
  /(?:code|coupon|promo)[:\s]+([A-Z0-9_\-]{4,25})/gi,
  /(?:use|enter|apply)\s+(?:code\s+)?["']?([A-Z0-9_\-]{4,25})["']?/gi,
  /\b([A-Z0-9]{4,20})\b(?=.*(?:off|save|discount|free))/gi,
  /["']([A-Z0-9_\-]{4,25})["']/g,
];

function extractCodes(text) {
  const found = new Set();
  for (const p of CODE_PATTERNS) {
    for (const m of text.matchAll(p)) {
      const code = (m[1] || m[0]).trim();
      if (code.length >= 4 && code.length <= 25 && /[A-Z0-9]{3,}/i.test(code)) {
        if (/^\d+$/.test(code) && code.length < 6) continue;
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

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
];

export async function discoverWithPlaywright(brand) {
  if (!playwright) return [];

  const { brandName, website } = brand;
  const base = website.replace(/\/$/, '');
  const results = [];
  let browser;

  try {
    browser = await playwright.chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const ctx = await browser.newContext({
      userAgent: ua,
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: [],
    });

    // Override navigator.webdriver
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // Mock chrome object
      window.chrome = { runtime: {} };
    });

    for (const pattern of PATTERNS) {
      const url = `${base}${pattern}`;
      try {
        const page = await ctx.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Wait a moment for dynamic content
        await page.waitForTimeout(2000);

        const text = await page.evaluate(() => document.body.innerText);

        // Check if cloudflare blocked us
        if (text.includes('Just a moment') || text.includes('Checking your browser')) {
          await page.close();
          continue;
        }

        const lower = text.toLowerCase();
        const matched = KEYWORDS.filter(kw => lower.includes(kw));
        if (matched.length < 2 && !extractCodes(text).length) {
          await page.close();
          continue;
        }

        const title = await page.title();
        const codes = extractCodes(text);
        const discount = DISCOUNT_PATTERNS.map(p => text.match(p)).find(Boolean)?.[0] || null;
        const desc = await page.evaluate(() =>
          document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
        );

        let confidence = Math.min(50 + matched.length * 8, 98);
        if (codes.length > 0) confidence = Math.min(confidence + 20, 99);
        if (discount) confidence = Math.min(confidence + 5, 99);

        results.push({
          sourceUrl: url,
          sourcePage: 'pw-' + pattern.replace('/', ''),
          sourceReliability: 'Official Site',
          confidence,
          title: (title || `${brandName} ${pattern}`).slice(0, 200),
          description: desc.slice(0, 500),
          discount: discount || 'Special offer',
          codes: [...new Set(codes)],
        });

        await page.close();
      } catch {
        // Skip
      }
    }

    await ctx.close();
  } catch (err) {
    console.error('  Playwright error:', err.message);
  } finally {
    if (browser) await browser.close();
  }

  return results;
}
