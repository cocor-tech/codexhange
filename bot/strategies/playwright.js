let playwright;
try {
  playwright = await import('playwright');
} catch {
  // Playwright not available
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

const UAs = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
];

function extractCodes(text) {
  const found = new Set();
  const re = /[A-Z0-9]{4,15}/g;
  const upper = text.toUpperCase();
  let m;
  while ((m = re.exec(upper)) !== null) {
    const c = m[0];
    if (c.length >= 4 && /[A-Z0-9]/.test(c) && !/^\d+$/.test(c) &&
        !['THIS','THAT','FROM','WITH','HAVE','THAN','SHOP','HOME',
          'PAGE','MENU','CART','HELP','FREE','SALE','CODE','COUP',
          'HTTP','HTTPS','WWW','HTML','CSS','JSON','BLOG','MAIN',
          'HEAD','BODY','DIV','SPAN','LINK','META','TITLE','FORM',
          'DATA','TEXT','FILE','SIZE','TYPE','NODE','EDGE','FIRE',
          'SAFARI','CHROME','OPERA','BRAVE'].includes(c)) {
      found.add(c);
    }
  }
  return [...found];
}

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
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    const ua = UAs[Math.floor(Math.random() * UAs.length)];
    const ctx = await browser.newContext({
      userAgent: ua,
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });

    // Override automation detection
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    for (const pattern of PATTERNS) {
      const url = `${base}${pattern}`;
      try {
        const page = await ctx.newPage();
        // Use domcontentloaded + timeout instead of networkidle (handles SPAs)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
        await page.waitForTimeout(2000);

        const text = await page.evaluate(() => document.body.innerText);

        // Skip Cloudflare or error pages
        if (!text || text.length < 100 || text.includes('Just a moment') || text.includes('Checking your browser')) {
          await page.close();
          continue;
        }

        const lower = text.toLowerCase();
        const hasKeywords = KEYWORDS.filter(kw => lower.includes(kw));
        if (hasKeywords.length < 2 && !extractCodes(text).length) {
          await page.close();
          continue;
        }

        const title = await page.title();
        const codes = extractCodes(text);
        const pct = lower.match(/(\d+%)\s*off/i);
        const dollar = lower.match(/\$(\d+)\s*off/i);
        const free = lower.match(/free\s+(trial|shipping|delivery)/i);

        let confidence = Math.min(50 + hasKeywords.length * 8, 95);
        if (codes.length > 0) confidence = Math.min(confidence + 20, 99);
        if (pct || dollar || free) confidence = Math.min(confidence + 5, 99);

        results.push({
          sourceUrl: url,
          sourcePage: 'pw-' + pattern.replace(/\//g, ''),
          sourceReliability: 'Official Site',
          confidence,
          title: (title || `${brandName} ${pattern}`).slice(0, 200),
          description: '',
          discount: pct?.[0] || dollar?.[0] || free?.[0] || 'Special offer',
          codes: [...new Set(codes)],
        });

        await page.close();
      } catch {
        // Skip on timeout/error
      }
    }

    await ctx.close();
  } catch (err) {
    console.error(`  Playwright error: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }

  return results;
}
