"""
Adapter for promocodes.com — scrapes real promo codes and offers.
Each brand page has structured JSON embedded in Next.js page data.
"""

import re, json, httpx
from urllib.parse import quote

BASE = "https://www.promocodes.com"

class PromoCodesAdapter:
    name = "promocodes"

    async def discover(self, brand: dict, client=None):
        brand_name = brand.get("brandName", brand.get("name", ""))
        slug = brand.get("slug", brand_name.lower().replace(" ", "-"))
        url = f"{BASE}/{quote(slug.lower())}"
        result = []

        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as c:
                r = await c.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                })

            if r.status_code != 200:
                return []

            match = re.search(r'<script id="__NEXT_DATA__"[^>]*>({.*?})</script>', r.text, re.DOTALL)
            if not match:
                return []

            data = json.loads(match.group(1))
            props = data.get("props", {}).get("pageProps", {})
            store_name = props.get("name", brand_name)

            all_offers = []
            for key in ["featuredOffers", "activeOffers"]:
                offers = props.get(key, [])
                if isinstance(offers, list):
                    all_offers.extend(offers)

            for o in all_offers:
                code = o.get("couponCode", "") or ""
                if code == "None":
                    code = ""

                headline = o.get("headline", "") or ""
                description = o.get("description", "") or ""
                savings = o.get("savings", "") or "0"
                discount = f"{savings}% off" if savings and savings != "0" else "Special offer"
                expires = o.get("expirationDate", None) or None
                is_verified = o.get("isVerified", "False") == "True"
                coupon_type = int(o.get("couponTypeId", 0))

                deal_type = "code"
                if coupon_type == 14:
                    deal_type = "sale"
                elif not code:
                    deal_type = "sale"

                source_url = f"{BASE}/{quote(slug.lower())}"

                entry = {
                    "sourceUrl": source_url,
                    "sourcePage": f"{BASE}/{quote(slug.lower())}",
                    "title": f"{headline[:200]}" if headline else f"{store_name} Offer",
                    "description": description[:500] if description else headline[:500],
                    "code": code if code else None,
                    "discount": discount,
                    "deal_type": deal_type,
                    "type": deal_type,
                    "confidence": 85 if code else 65,
                    "countries": [],
                    "store_name": store_name,
                    "sourceReliability": "Affiliate",
                    "_adapter": self.name,
                    "blocked": False,
                }
                if expires and expires != "None":
                    entry["expiresAt"] = expires

                result.append(entry)

        except Exception as e:
            pass

        return result
