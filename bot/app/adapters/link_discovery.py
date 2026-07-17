import re
from urllib.parse import urljoin
from bs4 import BeautifulSoup

DEAL_KW = ['coupon','promo','discount','deal','offer','sale','save','free','voucher','refer','reward','bonus','gift','student','welcome','signup','trial','cashback','bundle']
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'

class LinkDiscoveryAdapter:
    name = "linkDiscovery"

    async def discover(self, brand: dict, client):
        base = brand['website'].rstrip('/')
        results = []
        try:
            r = await client.get(base, timeout=4.0)
            if r.status_code != 200: return results
            soup = BeautifulSoup(r.text, 'lxml')
            found = {}
            for a in soup.find_all('a', href=True):
                try:
                    full = urljoin(base, a['href'])
                    if not full.startswith(base) or full in (base, base + '/'): continue
                except: continue
                text = a.get_text(strip=True).lower()
                path = full.lower()
                if not any(kw in path or kw in text for kw in DEAL_KW): continue
                if re.search(r'login|signin|logout|register|cart|checkout|account|profile|order|shipping|contact|about|privacy|terms|returns', path) and \
                   not any(kw in path for kw in ['coupon','promo','deal','offer','discount','sale']): continue
                key = full.rstrip('/').lower()
                if key in found: continue
                found[key] = True
                conf = 50
                if re.search(r'coupon|promo|deal|offer|discount|sale', path): conf += 20
                if re.search(r'free|save|percent|off|gift|reward', path): conf += 10
                dm = re.search(r'(\d+%\s*off|\$\d+\s*off|free\s+\w+)', text, re.I)
                parent = a.parent
                context = parent.get_text(strip=True)[:300] if parent else ''
                results.append({"sourceUrl": full, "sourcePage": "link-discovery", "confidence": min(conf, 95),
                                "title": a.get_text(strip=True)[:200], "description": context,
                                "discount": dm.group(0) if dm else 'Special offer', "codes": [], "blocked": False})
        except: pass
        results.sort(key=lambda x: x['confidence'], reverse=True)
        return results
