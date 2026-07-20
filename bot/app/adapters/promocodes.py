"""
Adapter for promocodes.com — extracts affiliate redirect URLs + promo codes.
Each brand page has Next.js data with offers including:
- networkUrl: the affiliate redirect URL that gives the user the discount
- couponCode: actual promo code string (if available)
"""

import re, json, httpx
from urllib.parse import quote

BASE = "https://www.promocodes.com"

async def _resolve_network_url(network_url: str) -> str:
    """Follow the affiliate redirect to get the final destination URL."""
    if not network_url:
        return network_url
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as c:
            r = await c.get(network_url, headers={"User-Agent": "Mozilla/5.0"})
            return str(r.url)
    except:
        pass
    return network_url

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
            top = props.get("topOffer")
            if isinstance(top, dict):
                all_offers.append(top)
            for key in ["featuredOffers", "activeOffers"]:
                offers = props.get(key, [])
                if isinstance(offers, list):
                    all_offers.extend(offers)

            for o in all_offers:
                coupon_id = o.get("couponId", None)
                headline = o.get("headline", "") or ""
                description = o.get("description", "") or ""
                savings = o.get("savings", "") or "0"
                discount = f"{savings}% off" if savings and savings != "0" else "Special offer"
                expires = o.get("expirationDate", None) or None
                coupon_type = int(o.get("couponTypeId", 0))
                code = o.get("couponCode", "") or ""
                if code == "None":
                    code = ""

                # The actual working link — affiliate redirect
                network_url = o.get("networkUrl", "") or ""
                final_url = network_url
                if not final_url:
                    brand_website = brand.get("website", "") or f"https://{slug.lower()}.com"
                    final_url = f"{brand_website}#offer={coupon_id or 0}"

                final_code = code or None
                final_type = "code" if final_code else ("sale" if coupon_type == 14 else "code")
                if not final_code and coupon_type != 14:
                    final_type = "sale"

                entry = {
                    "sourceUrl": final_url,
                    "sourcePage": url,
                    "title": f"{headline[:200]}" if headline else f"{store_name} Offer",
                    "description": description[:500] if description else headline[:500],
                    "code": final_code,
                    "discount": discount,
                    "deal_type": final_type,
                    "type": "promo_code" if final_code else final_type,
                    "confidence": 85 if final_code else 65,
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
