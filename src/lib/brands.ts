export const BRAND_CATEGORIES: Record<string, string> = {
  nordvpn: 'Tech & SaaS',
  hostinger: 'Tech & SaaS',
  expressvpn: 'Tech & SaaS',
  dropbox: 'Tech & SaaS',
  zoom: 'Tech & SaaS',
  slack: 'Tech & SaaS',
  github: 'Tech & SaaS',
  canva: 'Tech & SaaS',
  adobe: 'Tech & SaaS',
  microsoft: 'Tech & SaaS',

  ubereats: 'Food & Delivery',
  doordash: 'Food & Delivery',
  grubhub: 'Food & Delivery',
  postmates: 'Food & Delivery',
  deliveroo: 'Food & Delivery',

  spotify: 'Streaming',
  hbo: 'Streaming',
  netflix: 'Streaming',
  hulu: 'Streaming',
  disney: 'Streaming',
  paramount: 'Streaming',

  nike: 'Fashion',
  adidas: 'Fashion',
  puma: 'Fashion',
  zara: 'Fashion',
  hm: 'Fashion',
  uniqlo: 'Fashion',

  uber: 'Travel',
  lyft: 'Travel',
  airbnb: 'Travel',
  booking: 'Travel',
  expedia: 'Travel',

  skillshare: 'Online Learning',
  coursera: 'Online Learning',
  udemy: 'Online Learning',
  edx: 'Online Learning',
  khanacademy: 'Online Learning',

  amazon: 'Shopping',
  ebay: 'Shopping',
  walmart: 'Shopping',
  target: 'Shopping',
  bestbuy: 'Shopping',
};

export const CATEGORY_BRANDS: Record<string, string[]> = {};

for (const [slug, cat] of Object.entries(BRAND_CATEGORIES)) {
  if (!CATEGORY_BRANDS[cat]) CATEGORY_BRANDS[cat] = [];
  CATEGORY_BRANDS[cat].push(slug);
}

export const CATEGORIES = Object.keys(CATEGORY_BRANDS);

export function getCategory(slug: string): string {
  return BRAND_CATEGORIES[slug] || 'Popular';
}

export function getRelatedSearches(category: string): string[] {
  const map: Record<string, string[]> = {
    'Tech & SaaS': [
      'Best SaaS Promo Codes 2026',
      'Active VPN Discount Coupons',
      'Cheap Software Deals Online',
    ],
    'Food & Delivery': [
      'Food Delivery Promo Codes 2026',
      'Free Delivery Coupons',
      'Restaurant Discount Deals',
    ],
    'Streaming': [
      'Streaming Service Coupons 2026',
      'Cheap Music Subscription Deals',
      'Movie Discount Promo Codes',
    ],
    'Fashion': [
      'Clothing Discount Codes 2026',
      'Sportswear Promo Deals',
      'Fashion Coupon Savings',
    ],
    'Travel': [
      'Travel Discount Codes 2026',
      'Ride Share Promo Deals',
      'Hotel Booking Coupons',
    ],
    'Online Learning': [
      'Online Course Discounts 2026',
      'E-Learning Promo Codes',
      'Skill Development Deals',
    ],
    'Shopping': [
      'Online Shopping Coupons 2026',
      'Retail Discount Codes',
      'Best Deal Promo Codes',
    ],
  };
  return map[category] || ['Active Promo Codes 2026', 'Verified Discount Deals'];
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function getDidYouMean(input: string, limit = 5): { slug: string; name: string; distance: number }[] {
  const inputLower = input.toLowerCase();
  const all = Object.keys(BRAND_CATEGORIES);
  const scored = all
    .map((slug) => ({
      slug,
      name: slug.charAt(0).toUpperCase() + slug.slice(1),
      distance: levenshteinDistance(inputLower, slug),
    }))
    .filter((s) => s.distance <= Math.max(2, Math.floor(input.length * 0.4)))
    .sort((a, b) => a.distance - b.distance);
  return scored.slice(0, limit);
}
