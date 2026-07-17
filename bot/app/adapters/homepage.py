import re
from bs4 import BeautifulSoup

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
SELECTORS = ['[class*="announcement"]','[class*="promo"]','[class*="offer"]','[class*="deal"]','[class*="discount"]','[class*="coupon"]','[class*="sale"]']
DEAL_WORDS = ['free','save','off','% off','discount','coupon','promo','deal','offer','sale','limited time','special offer']

class HomepageAdapter:
    name = "homepage"

    async def discover(self, brand: dict, client):
        url = brand['website'].rstrip('/')
        bn = brand['brandName']
        results = []
        try:
            r = await client.get(url, timeout=4.0)
            if r.status_code != 200: return results
            soup = BeautifulSoup(r.text, 'lxml')
            text = soup.get_text().lower()
            deal_els = []
            for sel in SELECTORS:
                for el in soup.select(sel):
                    t = el.get_text(strip=True)
                    if 5 < len(t) < 200: deal_els.append(t)
            pct = re.search(r'(\d+%)\s*off', text)
            dollar = re.search(r'\$(\d+)\s*off', text)
            free = re.search(r'free\s+(trial|shipping|delivery)', text)
            conf = 0
            discount = ''
            title = ''
            if deal_els:
                conf = 60 + min(len(deal_els) * 5, 30)
                title = deal_els[0][:200]
                discount = (pct or dollar or free).group(0) if (pct or dollar or free) else 'Special offer'
            elif pct or dollar or free:
                conf = 40
                discount = (pct or dollar or free).group(0)
                title = f"{bn} — {discount}"
            if conf > 0:
                meta = soup.find('meta', attrs={'name': 'description'})
                desc = meta.get('content', '')[:500] if meta else ''
                results.append({"sourceUrl": url, "sourcePage": "homepage", "confidence": conf,
                                "title": title[:200], "description": desc, "discount": discount or 'Check homepage',
                                "codes": [], "blocked": False})
            try:
                blog_r = await client.get(f"{url}/blog", timeout=3.0)
                if blog_r.status_code == 200:
                    blog_soup = BeautifulSoup(blog_r.text, 'lxml')
                    blog_text = blog_soup.get_text().lower()
                    if any(w in blog_text for w in DEAL_WORDS):
                        results.append({"sourceUrl": f"{url}/blog", "sourcePage": "blog", "confidence": 50,
                                        "title": f"{bn} Blog — possible deals", "description": "",
                                        "discount": "Check blog for offers", "codes": [], "blocked": False})
            except: pass
        except: pass
        return results
