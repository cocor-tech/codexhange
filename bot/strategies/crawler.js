import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const DEAL_WORDS = [
  'coupon', 'promo', 'discount', 'deal', 'offer', 'sale', 'save',
  'free', 'voucher', 'refer', 'reward', 'bonus', 'gift', 'special',
  'student', 'welcome', 'signup', 'subscribe', 'exclusive',
  'limited', 'flash', 'clearance', 'outlet', 'first', 'referral',
  'invite', 'loyalty', 'cashback', 'bundle', 'package',
  'trial', 'freebie', 'giveaway', 'anniversary', 'birthday',
];

const IGNORE_PATHS = [
  '/login', '/signin', '/logout', '/register', '/cart', '/checkout',
  '/account', '/profile', '/order', '/shipping', '/contact',
  '/about', '/privacy', '/terms', '/returns', '/help',
  '/support', '/faq', '/blog', '/news', '/press',
  '/api/', '/cdn-', '/assets', '/images', '/css', '/js',
  '.pdf', '.jpg', '.png', '.gif', '.svg', '.webp',
];

const PCT_RE = /(\d+%)\s*off|save\s+\$?(\d+)|free\s+(trial|shipping|delivery)/i;

function extractCodes(text) {
  const found = new Set();
  const pageText = text.toUpperCase();
  let m;
  const codeRe = /[A-Z0-9]{4,15}/g;
  while ((m = codeRe.exec(pageText)) !== null) {
    const c = m[0];
    if (c.length >= 4 && /[A-Z0-9]/.test(c) && !/^\d+$/.test(c) &&
        !c.startsWith('HTTP') && !c.includes('WWW.')) {
      // Skip common non-code words
      if (['THIS', 'THAT', 'FROM', 'WITH', 'HAVE', 'THAN', 'SHOP',
           'HOME', 'PAGE', 'MENU', 'CART', 'HELP', 'FREE',
           'SALE', 'CODE', 'COUP'].includes(c)) continue;
      found.add(c);
    }
  }
  return [...found];
}

function scorePage(text, url) {
  const t = text.toLowerCase();
  let score = 20;

  const kwCount = DEAL_WORDS.filter(w => t.includes(w)).length;
  score += kwCount * 4;

  const codes = extractCodes(t);
  if (codes.length > 0) score += Math.min(codes.length * 3, 20);

  if (PCT_RE.test(t)) score += 15;
  if (/coupon|promo|deal|offer|discount|sale|free|save/i.test(url)) score += 15;

  const pctCount = (t.match(/%/g) || []).length;
  if (pctCount > 2) score += 10;

  return Math.min(score, 99);
}

// Cheerio-based crawl (for static sites)
async function cheerioCrawl(brand) {
  const { brandName, website } = brand;
  const base = website.replace(/\/$/, '');
  const results = [];

  try {
    const res = await fetch(base, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
      redirect: 'follow',
    });
    if (!res.ok) return results;

    const html = await res.text();
    const $ = cheerio.load(html);
    const homeText = $('body').text();

    // Score homepage
    const hScore = scorePage(homeText, base);
    if (hScore >= 45) {
      results.push({
        sourceUrl: base, sourcePage: 'crawl-home', confidence: hScore,
        title: $('title').text().trim() || brandName,
        description: $('meta[name="description"]').attr('content') || '',
        discount: homeText.match(PCT_RE)?.[0] || 'Special offer',
        codes: extractCodes(homeText),
      });
    }

    // Follow links
    const visited = new Set([base.replace(/\/$/, '').toLowerCase()]);
    const links = [];

    $('a[href]').each((_, el) => {
      try {
        const href = $(el).attr('href');
        if (!href) return;
        const full = new URL(href, base).href;
        const path = full.replace(/\/$/, '').toLowerCase();
        if (!full.startsWith(base) && !full.startsWith(base.replace('www.', ''))) return;
        if (visited.has(path)) return;
        if (IGNORE_PATHS.some(ig => path.includes(ig))) return;
        visited.add(path);
        links.push(full);
      } catch {}
    });

    // Fetch top pages (sorted by deal relevance)
    const toFetch = links.sort((a, b) => {
      return (DEAL_WORDS.some(w => b.toLowerCase().includes(w)) ? 1 : 0) -
             (DEAL_WORDS.some(w => a.toLowerCase().includes(w)) ? 1 : 0);
    }).slice(0, 10);

    for (const url of toFetch) {
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 Chrome/126' },
          timeout: 8000, redirect: 'follow',
        });
        if (!r.ok) continue;
        const body = await r.text();
        const $$ = cheerio.load(body);
        const pageText = $$('body').text();
        const score = scorePage(pageText, url);

        if (score >= 45) {
          results.push({
            sourceUrl: url, sourcePage: 'crawl-link', confidence: score,
            title: $$('title').text().trim() || '',
            description: $$('meta[name="description"]').attr('content') || '',
            discount: pageText.match(PCT_RE)?.[0] || 'Special offer',
            codes: extractCodes(pageText),
          });
        }
      } catch {}
    }
  } catch {}

  return results;
}

// Playwright-based crawl (for JS-heavy sites)
async function playwrightCrawl(brand) {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });
    const page = await ctx.newPage();

    const { brandName, website } = brand;
    const base = website.replace(/\/$/, '');
    const results = [];

    try {
      // Load homepage with networkidle to wait for API calls
      await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
      // Extra wait for any remaining dynamic content
      await page.waitForTimeout(3000);

      const homeText = await page.evaluate(() => document.body.innerText);
      const homeTitle = await page.title();

      const hScore = scorePage(homeText, base);
      if (hScore >= 45) {
        results.push({
          sourceUrl: base, sourcePage: 'crawl-pw-home', confidence: hScore,
          title: homeTitle || brandName, description: '',
          discount: homeText.match(PCT_RE)?.[0] || 'Special offer',
          codes: extractCodes(homeText),
        });
      }

      // Extract internal links
      const links = await page.evaluate((base) => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('a[href]').forEach(a => {
          try {
            const href = a.href;
            if (!href || !href.startsWith(base)) return;
            const path = href.replace(/\/$/, '').toLowerCase();
            if (seen.has(path)) return;
            seen.add(path);
            results.push(href);
          } catch {}
        });
        return results;
      }, base);

      // Filter and score links
      const dealLinks = links.filter(l => {
        const p = l.toLowerCase();
        return !IGNORE_PATHS.some(ig => p.includes(ig)) &&
               DEAL_WORDS.some(w => p.includes(w));
      }).slice(0, 8);

      // Visit each deal link with networkidle
      for (const link of dealLinks) {
        try {
          await page.goto(link, { waitUntil: 'networkidle', timeout: 15000 });
          await page.waitForTimeout(2000);

          const text = await page.evaluate(() => document.body.innerText);
          const title = await page.title();
          const score = scorePage(text, link);

          if (score >= 45) {
            results.push({
              sourceUrl: link, sourcePage: 'crawl-pw-link', confidence: score,
              title: title || '',
              description: '',
              discount: text.match(PCT_RE)?.[0] || 'Special offer',
              codes: extractCodes(text),
            });
          }
        } catch {}
      }
    } catch {}

    await browser.close();
    return results;
  } catch {
    return [];
  }
}

export async function crawlBrand(brand) {
  // Try Playwright first (catches JS sites), fall back to cheerio
  if (process.env.PLAYWRIGHT !== 'false') {
    const pwResults = await playwrightCrawl(brand);
    if (pwResults.length > 0) return pwResults;
  }
  return cheerioCrawl(brand);
}
