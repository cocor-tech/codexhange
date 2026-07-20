"""
Adapter for groupon.com — extracts deal links, prices, descriptions.
Data is in __NEXT_DATA__ → props → __APOLLO_STATE__
"""

import re, json, httpx
from urllib.parse import quote

BASE = "https://www.groupon.com"

class GrouponAdapter:
    name = "groupon"

    async def discover(self, brand: dict, client=None):
        brand_name = brand.get("brandName", brand.get("name", ""))
        slug = brand.get("slug", brand_name.lower().replace(" ", "-"))
        url = f"{BASE}/browse/{quote(slug.lower())}"
        result = []

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as c:
                r = await c.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                })

            if r.status_code != 200:
                return []

            match = re.search(r'<script id="__NEXT_DATA__"[^>]*>({.*?})</script>', r.text, re.DOTALL)
            if not match:
                return []

            data = json.loads(match.group(1))
            apollo = data.get("props", {}).get("pageProps", {}).get("__APOLLO_STATE__", {})
            if not apollo:
                return []

            seen = set()
            for key, val in apollo.items():
                if not isinstance(val, dict):
                    continue
                tn = val.get("__typename", "")
                if "Deal" not in tn and "deal" not in tn.lower():
                    continue

                title = val.get("title", val.get("name", "")) or ""
                if not title:
                    continue

                buy_url = val.get("buyUrl", val.get("externalUrl", "")) or ""
                if not buy_url or buy_url in seen:
                    continue
                seen.add(buy_url)

                price = val.get("unformattedPrice", {})
                if isinstance(price, dict):
                    amt = price.get("amount", 0)
                else:
                    amt = 0

                dis = val.get("discount", val.get("promotion", "")) or ""
                merchant = val.get("merchant", val.get("store", "")) or ""
                if isinstance(merchant, dict):
                    merchant = merchant.get("name", "") or ""
                if not merchant:
                    merchant = brand_name

                discount_str = f"${amt//100} value" if amt else (str(dis) if dis else "Groupon Deal")

                entry = {
                    "sourceUrl": buy_url,
                    "sourcePage": url,
                    "title": str(title)[:200],
                    "description": str(val.get("shortDescription", val.get("description", "")))[:500],
                    "code": None,
                    "discount": discount_str,
                    "deal_type": "sale",
                    "type": "sale",
                    "confidence": 65,
                    "countries": [],
                    "store_name": merchant or brand_name,
                    "sourceReliability": "Groupon",
                    "_adapter": self.name,
                    "blocked": False,
                }
                result.append(entry)

        except:
            pass

        return result
