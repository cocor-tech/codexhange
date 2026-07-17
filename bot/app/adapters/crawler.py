import asyncio, re
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from app.extractors import extract_codes_from_text, detect_countries

DEAL_WORDS = ['coupon','promo','discount','deal','offer','sale','save','free','voucher','refer','reward','bonus','gift','special','student','welcome','signup','trial','cashback']
IGNORE = ['/login','/signin','/logout','/register','/cart','/checkout','/account','/profile','/order','/shipping','/contact','/about','/privacy','/terms','/returns','/help','/support','/faq']
DISCOUNT_RE = re.compile(r'(\d+%)\s*off|save\s+\$\d+|free\s+(trial|shipping)', re.I)
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0'

def score_page(text, url, brand_name=""):
    t = text.lower()
    score = 20 + sum(4 for w in DEAL_WORDS if w in t)
    codes = extract_codes_from_text(t, url, brand_name)
    if codes: score += min(len(codes) * 3, 20)
    if DISCOUNT_RE.search(t): score += 15
    if re.search(r'coupon|promo|deal|offer|discount|sale|free|save', url): score += 10
    return min(score, 99)

class CrawlerAdapter:
    name = "crawler"

    async def discover(self, brand: dict, client):
        base = brand['website'].rstrip('/')
        bn = brand['brandName']
        results = []
        def fetch_page(url):
            return client.get(url, timeout=4.0)
        try:
            r = await fetch_page(base)
            if r.status_code != 200: return results
            home_soup = BeautifulSoup(r.text, 'lxml')
            home_text = home_soup.get_text()
            if len(home_text) < 200: return results
            hs = score_page(home_text, base, bn)
            if hs >= 45:
                dm = DISCOUNT_RE.search(home_text)
                codes = extract_codes_from_text(home_text, base, bn)
                results.append({"sourceUrl": base, "sourcePage": "crawl-home", "confidence": hs,
                                "title": (home_soup.find('title') or home_soup).get_text(strip=True) or bn,
                                "description": "", "discount": dm.group(0) if dm else 'Special offer',
                                "codes": codes, "blocked": False})
            links = []
            visited = {base.rstrip('/').lower()}
            for a in home_soup.find_all('a', href=True):
                try:
                    full = urljoin(base, a['href'])
                    path = full.rstrip('/').lower()
                    if not full.startswith(base) or path in visited: continue
                    if any(ig in path for ig in IGNORE): continue
                    visited.add(path)
                    links.append({'url': full, 'text': a.get_text(strip=True).lower()})
                except: pass
            links.sort(key=lambda x: sum(1 for w in DEAL_WORDS if w in x['text']), reverse=True)
            top = links[:3]
            pages = await asyncio.gather(*[fetch_page(l['url']) for l in top])
            for i, pg in enumerate(pages):
                if not pg or pg.status_code != 200: continue
                soup = BeautifulSoup(pg.text, 'lxml')
                text = soup.get_text()
                score = score_page(text, top[i]['url'], bn)
                if score >= 45:
                    dm = DISCOUNT_RE.search(text)
                    codes = extract_codes_from_text(text, top[i]['url'], bn)
                    results.append({"sourceUrl": top[i]['url'], "sourcePage": "crawl-link", "confidence": score,
                                    "title": (soup.find('title') or soup).get_text(strip=True) or '',
                                    "description": "", "discount": dm.group(0) if dm else 'Special offer',
                                    "codes": codes, "blocked": False})
        except: pass
        return results
