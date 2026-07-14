const URL_REGEX = /^https?:\/\/[^\s]+$/i;
const DOMAIN_REGEX = /https?:\/\/(?:[a-z0-9-]+\.)?([a-z0-9-]+)(?:\.[a-z]{2,}(?:\.[a-z]{2,})?)/i;

const DOMAIN_BRAND_MAP: Record<string, string> = {
  jumia: 'Jumia',
  amazon: 'Amazon',
  ebay: 'eBay',
  walmart: 'Walmart',
  target: 'Target',
  bestbuy: 'Best Buy',
  aliexpress: 'AliExpress',
  alibaba: 'Alibaba',
  shopify: 'Shopify',
  etsy: 'Etsy',
  wix: 'Wix',
  godaddy: 'GoDaddy',
  hostinger: 'Hostinger',
  namecheap: 'Namecheap',
  nordvpn: 'NordVPN',
  expressvpn: 'ExpressVPN',
  netflix: 'Netflix',
  spotify: 'Spotify',
  disney: 'Disney+',
  hbo: 'HBO',
  hulu: 'Hulu',
  uber: 'Uber',
  lyft: 'Lyft',
  doordash: 'DoorDash',
  ubereats: 'UberEats',
  grubhub: 'Grubhub',
  nike: 'Nike',
  adidas: 'Adidas',
  puma: 'Puma',
  zara: 'Zara',
  hm: 'H&M',
  uniqlo: 'Uniqlo',
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  expedia: 'Expedia',
  skillshare: 'Skillshare',
  coursera: 'Coursera',
  udemy: 'Udemy',
  canva: 'Canva',
  adobe: 'Adobe',
  microsoft: 'Microsoft',
  dropbox: 'Dropbox',
  github: 'GitHub',
  zoom: 'Zoom',
  slack: 'Slack',
  'steampowered': 'Steam',
  epicgames: 'Epic Games',
  playstation: 'PlayStation',
  xbox: 'Xbox',
  nintendo: 'Nintendo',
};

export function isURL(input: string): boolean {
  return URL_REGEX.test(input.trim());
}

export function extractDomain(input: string): string | null {
  const match = input.trim().match(DOMAIN_REGEX);
  if (!match) return null;
  return match[1].toLowerCase();
}

export function normalizeText(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ');
}

export function getBrandFromURL(input: string): { brand: string; slug: string } | null {
  const domain = extractDomain(input);
  if (!domain) return null;
  const brandName = DOMAIN_BRAND_MAP[domain];
  if (brandName) {
    return { brand: brandName, slug: domain };
  }
  return { brand: domain.charAt(0).toUpperCase() + domain.slice(1), slug: domain };
}

export function classifyInput(input: string): { type: 'url' | 'keyword'; extracted?: { brand: string; slug: string } } {
  const trimmed = input.trim();
  if (isURL(trimmed)) {
    const extracted = getBrandFromURL(trimmed);
    return { type: 'url', extracted: extracted || undefined };
  }
  return { type: 'keyword' };
}

export function shouldNoindex(query: string, totalResults: number): boolean {
  return totalResults === 0 && query.length > 0;
}
