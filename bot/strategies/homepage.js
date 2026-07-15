import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const UAs = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
];

function ua() { return UAs[Math.floor(Math.random() * UAs.length)]; }

const DEAL_SELECTORS = [
  '[class*="announcement"]', '[class*="announce"]', '[class*="banner"]',
  '[class*="promo"]', '[class*="offer"]', '[class*="deal"]',
  '[class*="discount"]', '[class*="coupon"]', '[class*="sale"]',
  '[class*="hero"]', '[class*="cta"]', '[class*="special"]',
  '[id*="announcement"]', '[id*="promo"]', '[id*="offer"]',
  '[aria-label*="announcement"]', '[aria-label*="promo"]',
];

const DEAL_WORDS = [
  'free', 'save', 'off', '% off', 'discount', 'coupon', 'promo',
  'deal', 'offer', 'sale', 'limited time', 'special offer',
  'get started', 'sign up', 'try free', 'start free',
  'refer', 'referral', 'invite', 'bonus', 'credit',
];

export async function scanHomepage(brand) {
  const { brandName, website } = brand;
  const url = website.replace(/\/$/, '');
  const results = [];

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': ua() },
      timeout: 10000,
      redirect: 'follow',
    });
    if (!res.ok) return results;

    const html = await res.text();
    const $ = cheerio.load(html);
    const text = $('body').text().toLowerCase();

    // Check for deal announcement elements
    const dealElements = [];
    for (const sel of DEAL_SELECTORS) {
      $(sel).each((_, el) => {
        const t = $(el).text().trim();
        if (t.length > 5 && t.length < 200) dealElements.push(t);
      });
    }

    // Check for common deal patterns in page text
    const pctMatch = text.match(/(\d+%)\s*off/i);
    const dollarMatch = text.match(/\$(\d+)\s*off/i);
    const freeMatch = text.match(/free\s+(trial|shipping|delivery)/i);

    let confidence = 0;
    let discount = '';
    let title = '';

    if (dealElements.length > 0) {
      confidence = 60 + Math.min(dealElements.length * 5, 30);
      title = dealElements[0].slice(0, 200);
      if (pctMatch) discount = pctMatch[0];
      else if (dollarMatch) discount = dollarMatch[0];
      else if (freeMatch) discount = freeMatch[0];
      else discount = 'Special offer';
    } else if (pctMatch || dollarMatch || freeMatch) {
      confidence = 40;
      discount = pctMatch?.[0] || dollarMatch?.[0] || freeMatch?.[0] || '';
      title = `${brandName} — ${discount}`;
    }

    if (confidence > 0) {
      results.push({
        sourceUrl: url,
        sourcePage: 'homepage',
        sourceReliability: 'Official Site',
        confidence,
        title: title.slice(0, 200),
        description: $('meta[name="description"]').attr('content')?.slice(0, 500) || '',
        discount: discount || 'Check homepage for offers',
        codes: [],
      });
    }

    // Also check /blog for deal-related posts
    try {
      const blogRes = await fetch(`${url}/blog`, {
        headers: { 'User-Agent': ua() },
        timeout: 8000,
        redirect: 'follow',
      });
      if (blogRes.ok) {
        const blogHtml = await blogRes.text();
        const blog$ = cheerio.load(blogHtml);
        const blogText = blog$.text().toLowerCase();
        if (DEAL_WORDS.some(w => blogText.includes(w))) {
          results.push({
            sourceUrl: `${url}/blog`,
            sourcePage: 'blog',
            sourceReliability: 'Official Site',
            confidence: 50,
            title: `${brandName} Blog — possible deals`,
            description: 'Blog contains deal-related keywords',
            discount: 'Check blog for offers',
            codes: [],
          });
        }
      }
    } catch {}

  } catch {}

  return results;
}
