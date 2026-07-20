"""
Adapter for couponbind.com — scrapes real promo codes.
Codes are exposed in data-code HTML attributes.
"""

import httpx
from bs4 import BeautifulSoup
from urllib.parse import quote

BASE = "https://www.couponbind.com"

class CouponBindAdapter:
    name = "couponbind"

    async def discover(self, brand: dict, client=None):
        brand_name = brand.get("brandName", brand.get("name", ""))
        slug = brand.get("slug", brand_name.lower().replace(" ", "-"))
        result = []

        # Try multiple domain variations
        domains = [f"{slug}.com", f"{slug}.net", slug]
        found = False

        for domain in domains:
            if found:
                break
            url = f"{BASE}/coupons/{quote(domain.lower())}"

            try:
                async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as c:
                    r = await c.get(url, headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    })

                if r.status_code != 200:
                    continue

                soup = BeautifulSoup(r.text, "lxml")
                code_elements = soup.find_all(attrs={"data-code": True})

                if not code_elements:
                    continue

                found = True
                for el in code_elements:
                    code = el.get("data-code", "").strip()
                    if not code or len(code) < 3:
                        continue

                    raw_title = el.get("data-title", "") or ""
                    parts = raw_title.split("Code")
                    title = parts[0].strip() if parts else raw_title

                    discount = "Special offer"
                    savings_match = __import__("re").search(r"(\d+%|\$\d+)", title)
                    if savings_match:
                        discount = savings_match.group(1)

                    result.append({
                        "sourceUrl": url,
                        "sourcePage": url,
                        "title": title[:200] if title else f"{brand_name} Promo Code",
                        "description": raw_title[:500] if raw_title else "",
                        "code": code,
                        "discount": discount,
                        "deal_type": "code" if code else "sale",
                        "type": "promo_code" if code else "sale",
                        "confidence": 85 if len(code) >= 4 else 70,
                        "countries": [],
                        "store_name": brand_name,
                        "sourceReliability": "Affiliate",
                        "_adapter": self.name,
                        "blocked": False,
                    })

            except Exception:
                continue

        return result
