import asyncio, re
from bs4 import BeautifulSoup
from app.extractors import extract_codes_from_soup, detect_countries
from app.services.fetcher import smart_fetch

DEAL_KW = ['coupon','promo','discount','deal','offer','sale','voucher','free','save','student']
PATHS = ['/sitemap.xml','/sitemap_index.xml','/sitemap/sitemap.xml']
DISCOUNT_RE = re.compile(r'(\d+%)\s*off|\$\d+\s*off|free\s+(trial|shipping|delivery)', re.I)

def score_url(url):
    p = url.lower()
    if re.search(r'/coupons?/?$', p): return 95
    if re.search(r'/promo[cs]?/?$', p): return 93
    if re.search(r'/deals?/?$', p): return 90
    if re.search(r'/sale/?$', p): return 85
    if re.search(r'/discount/?$', p): return 85
    return min(50 + sum(1 for kw in DEAL_KW if kw in p) * 8, 98)

class SitemapAdapter:
    name = "sitemap"

    async def discover(self, brand: dict, client):
        base = brand['website'].rstrip('/')
        bn = brand['brandName']
        async def fetch_sitemap(path):
            try:
                r = await client.get(f"{base}{path}", timeout=4.0)
                return r.text if r.status_code == 200 else None
            except: return None
        xmls = [x for x in await asyncio.gather(*[fetch_sitemap(p) for p in PATHS]) if x]
        if not xmls: return []
        all_urls = set()
        for x in xmls:
            for m in re.finditer(r'<loc>(.*?)</loc>', x, re.I): all_urls.add(m.group(1))
        deals = [u for u in all_urls if any(kw in u.lower() for kw in DEAL_KW)]
        if not deals: return []
        top = deals[:5]
        async def fetch_page(url):
            try:
                result = await smart_fetch(client, url, timeout=5.0)
                if result["status"] != 200: return None
                soup = BeautifulSoup(result["text"], 'lxml')
                codes = extract_codes_from_soup(soup, url, bn)
                text = soup.get_text().lower()
                dm = DISCOUNT_RE.search(text)
                h1 = soup.find('h1')
                title = h1.get_text(strip=True) if h1 else (soup.find('title').get_text(strip=True) if soup.find('title') else '')
                return {'url': url, 'title': title, 'codes': codes, 'discount': dm.group(0) if dm else None,
                        'countries': detect_countries(url, result["text"], bn), 'blocked': result.get('blocked', False)}
            except: return None
        pages = await asyncio.gather(*[fetch_page(u) for u in top])
        pm = {p['url']: p for p in pages if p}
        results = []
        seen = set()
        for url in deals[:10]:
            k = url.rstrip('/').lower()
            if k in seen: continue
            seen.add(k)
            p = pm.get(url)
            if p and p.get('blocked'):
                results.append({"sourceUrl": url, "blocked": True, "blocked_reason": "cloudflare",
                                "codes": [], "confidence": 0, "title": "", "discount": "", "countries": []})
                continue
            conf = score_url(url)
            title = (p['title'] if p and p['title'] else f"{bn} — {url.split('/')[-1].replace('-',' ') or 'Deal page'}")[:200]
            codes = p['codes'] if p else []
            if codes: conf = min(conf + 15, 99)
            results.append({"sourceUrl": url, "sourcePage": "sitemap", "confidence": conf, "title": title,
                            "description": "", "discount": p['discount'] if p and p['discount'] else "Check page",
                            "codes": codes, "countries": p['countries'] if p else [], "blocked": False})
        return results
