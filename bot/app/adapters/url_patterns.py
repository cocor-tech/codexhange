import asyncio, re
from bs4 import BeautifulSoup
from app.extractors import extract_codes_from_soup, detect_countries
from app.services.fetcher import fetch_direct, is_cloudflare

PATTERNS = [
    '/coupons','/promo','/promo-codes','/promo-code','/discount',
    '/deals','/offers','/promotions','/sale',
    '/coupon-codes','/coupon','/voucher','/vouchers',
    '/new-customer','/welcome','/first-order',
    '/signup-offer','/sign-up','/free-trial','/freetrial',
    '/student','/student-discount','/students',
    '/education','/referral','/refer',
    '/rewards','/loyalty','/cashback','/gift-card',
    '/pricing','/plans','/subscription',
    '/black-friday','/flash-sale','/clearance',
    '/affiliate','/partner',
    '/free','/freebies','/free-shipping',
    '/bundle','/promos',
]
KEYWORDS = ['coupon','promo code','promo','discount','deal','offer','save','sale','voucher','free trial','student']
DISCOUNT_RE = re.compile(r'(\d+%)\s*off|\$\d+\s*off|free\s+(trial|shipping|delivery)', re.I)

class UrlPatternsAdapter:
    name = "urlPatterns"

    async def discover(self, brand: dict, client):
        base = brand['website'].rstrip('/')
        brand_name = brand['brandName']
        sem = asyncio.Semaphore(20)

        async def fetch(pattern):
            url = f"{base}{pattern}"
            async with sem:
                try:
                    result = await fetch_direct(client, url, timeout=4.0)
                    if result["status"] != 200:
                        return None if not result.get("blocked") else {
                            "sourceUrl": url, "blocked": True, "blocked_reason": "cloudflare",
                            "codes": [], "confidence": 0, "title": "", "discount": "", "countries": []
                        }
                    if is_cloudflare(result["text"]):
                        return {"sourceUrl": url, "blocked": True, "blocked_reason": "cloudflare",
                                "codes": [], "confidence": 0, "title": "", "discount": "", "countries": []}
                    soup = BeautifulSoup(result["text"], 'lxml')
                    text = soup.get_text().lower()
                    codes = extract_codes_from_soup(soup, url, brand_name)
                    kw = sum(1 for k in KEYWORDS if k in text)
                    if kw < 2 and not codes: return None
                    conf = 40 + kw * 6 + (20 if codes else 0)
                    title_el = soup.find('title')
                    title = title_el.get_text(strip=True) if title_el else ''
                    if any(k in title.lower() for k in KEYWORDS): conf += 10
                    conf = min(conf, 99)
                    dm = DISCOUNT_RE.search(text)
                    countries = detect_countries(url, result["text"], brand_name)
                    return {
                        "sourceUrl": url, "sourcePage": pattern, "countries": countries,
                        "confidence": conf, "title": title[:200], "description": "",
                        "discount": dm.group(0) if dm else "Special offer",
                        "codes": codes, "blocked": False,
                    }
                except:
                    return None

        results = await asyncio.gather(*[fetch(p) for p in PATTERNS])
        return [r for r in results if r]
