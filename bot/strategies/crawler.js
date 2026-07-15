import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const DEAL_WORDS = [
  'coupon', 'promo', 'discount', 'deal', 'offer', 'sale', 'save',
  'free', 'voucher', 'refer', 'reward', 'bonus', 'gift', 'special',
  'student', 'welcome', 'signup', 'subscribe', 'exclusive',
  'limited', 'flash', 'clearance', 'outlet', 'first', 'referral',
  'invite', 'loyalty', 'cashback', 'bundle', 'trial',
];

const IGNORE_PATHS = [
  '/login', '/signin', '/logout', '/register', '/cart', '/checkout',
  '/account', '/profile', '/order', '/shipping', '/contact',
  '/about', '/privacy', '/terms', '/returns', '/help',
  '/support', '/faq', '/blog/', '/news/', '/press/',
  '/api/', '/cdn-', '/assets', '/images', '/css', '/js',
  '.pdf', '.jpg', '.png', '.gif', '.svg', '.webp',
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
          'PAGE','MENU','CART','HELP','FREE','SALE','CODE','HTTP',
          'WWW','HTML','CSS','JSON','BLOG','TEXT','FILE','SIZE',
          'TYPE','DATA','LINK','META','HEAD','BODY','FORM'].includes(c)) {
      found.add(c);
    }
  }
  return [...found];
}

function scorePage(text, url) {
  const t = text.toLowerCase();
  let score = 20;
  score += DEAL_WORDS.filter(w => t.includes(w)).length * 4;
  const codes = extractCodes(t);
  if (codes.length > 0) score += Math.min(codes.length * 3, 20);
  if (/(\d+%)\s*off|save\s+\$|free\s+(trial|shipping)/i.test(t)) score += 15;
  if (/coupon|promo|deal|offer|discount|sale|free|save/i.test(url)) score += 10;
  return Math.min(score, 99);
}

async function fetchCheerio(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
      redirect: 'follow', follow: 3,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    return { text: $('body').text(), title: $('title').text().trim(), $ };
  } catch { return null; }
}

async function processCheerio(brand) {
  const { brandName, website } = brand;
  const base = website.replace(/\/$/, '');
  const results = [];
  const visited = new Set([base.replace(/\/$/, '').toLowerCase()]);

  const home = await fetchCheerio(base);
  if (!home || home.text.length < 200) return results;

  const hScore = scorePage(home.text, base);
  if (hScore >= 45) {
    results.push({
      sourceUrl: base, sourcePage: 'crawl-home', confidence: hScore,
      title: home.title || brandName, description: '',
      discount: home.text.match(/(\d+%\s*off|save\s+\$\d+|free\s+\w+)/i)?.[0] || 'Special offer',
      codes: extractCodes(home.text),
    });
  }

  // Extract internal links from homepage
  const links = [];
  home.$('a[href]').each((_, el) => {
    try {
      const href = home.$(el).attr('href');
      if (!href) return;
      const full = new URL(href, base).href;
      const path = full.replace(/\/$/, '').toLowerCase();
      if (!full.startsWith(base)) return;
      if (visited.has(path)) return;
      if (IGNORE_PATHS.some(ig => path.includes(ig))) return;
      visited.add(path);
      links.push({ url: full, text: home.$(el).text().toLowerCase() });
    } catch {}
  });

  // Sort by deal relevance, take top 8
  const toVisit = links.sort((a, b) => {
    const aScore = DEAL_WORDS.some(w => a.text.includes(w)) ? 1 : 0;
    const bScore = DEAL_WORDS.some(w => b.text.includes(w)) ? 1 : 0;
    return bScore - aScore;
  }).slice(0, 8);

  for (const link of toVisit) {
    const data = await fetchCheerio(link.url);
    if (!data) continue;
    const score = scorePage(data.text, link.url);
    if (score >= 45) {
      results.push({
        sourceUrl: link.url, sourcePage: 'crawl-link', confidence: score,
        title: data.title || '',
        description: '',
        discount: data.text.match(/(\d+%\s*off|save\s+\$\d+|free\s+\w+)/i)?.[0] || 'Special offer',
        codes: extractCodes(data.text),
      });
    }
  }

  return results;
}

async function processPlaywright(brand) {
  try {
    const { chromium } = await import('playwright');
    const { brandName, website } = brand;
    const base = website.replace(/\/$/, '');
    const results = [];

    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0',
      viewport: { width: 1920, height: 1080 },
    });
    const page = await ctx.newPage();

    try {
      // Use domcontentloaded + wait instead of networkidle (handles SPAs with persistent connections)
      await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);

      const text = await page.evaluate(() => document.body.innerText);

      // Skip empty/blocked pages
      if (!text || text.length < 200 || text.includes('Just a moment')) {
        await browser.close();
        return results;
      }

      const title = await page.title();
      const hScore = scorePage(text, base);
      if (hScore >= 45) {
        results.push({
          sourceUrl: base, sourcePage: 'crawl-pw-home', confidence: hScore,
          title: title || brandName, description: '',
          discount: text.match(/(\d+%\s*off|save\s+\$\d+|free\s+\w+)/i)?.[0] || 'Special offer',
          codes: extractCodes(text),
        });
      }

      // Extract links
      const links = await page.evaluate((b) => {
        const seen = new Set();
        const res = [];
        document.querySelectorAll('a[href]').forEach(a => {
          try {
            const h = a.href;
            if (!h || !h.startsWith(b)) return;
            const p = h.replace(/\/$/, '').toLowerCase();
            if (seen.has(p)) return;
            seen.add(p);
            res.push(h);
          } catch {}
        });
        return res;
      }, base);

      const dealLinks = links.filter(l => {
        const p = l.toLowerCase();
        return DEAL_WORDS.some(w => p.includes(w)) && !IGNORE_PATHS.some(ig => p.includes(ig));
      }).slice(0, 5);

      for (const link of dealLinks) {
        try {
          await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 12000 });
          await page.waitForTimeout(2000);
          const t = await page.evaluate(() => document.body.innerText);
          if (!t || t.length < 100) continue;
          const s = scorePage(t, link);
          if (s >= 45) {
            results.push({
              sourceUrl: link, sourcePage: 'crawl-pw-link', confidence: s,
              title: await page.title() || '',
              description: '',
              discount: t.match(/(\d+%\s*off|save\s+\$\d+|free\s+\w+)/i)?.[0] || 'Special offer',
              codes: extractCodes(t),
            });
          }
        } catch {}
      }
    } catch {}

    await browser.close();
    return results;
  } catch { return []; }
}

export async function crawlBrand(brand) {
  if (process.env.PLAYWRIGHT !== 'false') {
    const pw = await processPlaywright(brand);
    if (pw.length > 0) return pw;
  }
  return processCheerio(brand);
}
