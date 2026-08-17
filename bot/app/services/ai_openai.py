"""
OpenAI-compatible provider for AI enrichment.
Works with any OpenAI-compatible API (OpenAI, Groq, Together, etc.).

Configuration:
  AI_PROVIDER=openai
  AI_API_KEY=<your-api-key>
  AI_MODEL=<model-name>
  AI_BASE_URL=<api-base-url>  (default: https://api.openai.com/v1)

Groq example:
  AI_PROVIDER=openai
  AI_API_KEY=gsk_...
  AI_MODEL=llama3-70b-8192
  AI_BASE_URL=https://api.groq.com/openai/v1
"""

import httpx
import json
from typing import Optional

class OpenAIProvider:
    def __init__(self, api_key: str, model: str = "gpt-4o-mini", base_url: str = "https://api.openai.com/v1"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.endpoint = f"{self.base_url}/chat/completions"

    async def _call(self, prompt: str, system_instruction: str = "") -> Optional[str]:
        if not self.api_key:
            return None
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        try:
            async with httpx.AsyncClient(timeout=30.0) as c:
                r = await c.post(
                    self.endpoint,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": messages,
                        "temperature": 0.2,
                        "max_tokens": 200,
                    },
                )
                if r.status_code != 200:
                    return None
                data = r.json()
                choices = data.get("choices", [])
                if not choices:
                    return None
                return choices[0].get("message", {}).get("content", "")
        except:
            return None

    async def summarize_offer(self, title: str, description: str = "") -> str:
        text = f"Title: {title}"
        if description:
            text += f"\nDescription: {description}"
        prompt = f"""Clean up this offer title. Remove brand names, extra punctuation, and generic words.
Keep the core offer (discount %, code, deal type). Return ONLY the cleaned title, max 80 chars.

{text}

Cleaned title:"""
        result = await self._call(prompt)
        if result and len(result) < 200:
            return result.strip().strip('"').strip("'")
        return title[:200]

    async def classify_offer(self, title: str, description: str = "") -> str:
        text = f"Title: {title}\nDescription: {description or 'N/A'}"
        prompt = f"""Classify this offer into EXACTLY one category:
- code: has a literal promo/coupon code string
- sale: percentage off, dollar off, automatic discount
- free_trial: free days, try free, no-risk trial
- student_discount: student/education/military discount
- referral: refer-a-friend, invite bonus
- deal: none of the above

Return ONLY the category name, nothing else.

{text}

Category:"""
        result = await self._call(prompt)
        if result in ("code", "sale", "free_trial", "student_discount", "referral", "deal"):
            return result
        return "deal"

    async def generate_tags(self, title: str, description: str = "") -> list:
        text = f"Title: {title}\nDescription: {description or 'N/A'}"
        prompt = f"""Generate 3-5 tags for this offer. Tags are short keywords.
Return as a JSON array of strings, nothing else.

{text}

Tags:"""
        result = await self._call(prompt)
        if result:
            try:
                tags = json.loads(result)
                if isinstance(tags, list):
                    return [str(t).strip() for t in tags if str(t).strip()][:5]
            except:
                pass
        return []

    async def detect_codes(self, page_text: str, brand_name: str = "") -> list:
        """Extract promo/coupon codes from scraped page text (AI fallback for regex)."""
        snippet = page_text[:6000]
        prompt = f"""You are extracting coupon codes from a scraped retail page for "{brand_name or 'the store'}".

Find ALL literal promo/coupon/voucher/discount codes on this page. Codes are:
- uppercase or mixed alphanumeric strings, usually 4-25 chars (e.g. SAVE20, WELCOME10, FALL25, FREESHIP)
- often inside quotes, near words like "code", "coupon", "promo", "voucher", "offer"
- NOT random words, menu items, prices, or dates

Return ONLY a JSON array of unique code strings. If none exist, return [].

Page text:
{snippet}

Codes:"""
        result = await self._call(prompt, "You extract coupon codes. Reply with JSON only.")
        if not result:
            return []
        try:
            codes = json.loads(result.strip())
            if isinstance(codes, list):
                return [str(c).strip() for c in codes if str(c).strip()]
        except Exception:
            import re
            m = re.search(r'\[.*\]', result, re.S)
            if m:
                try:
                    codes = json.loads(m.group(0))
                    if isinstance(codes, list):
                        return [str(c).strip() for c in codes if str(c).strip()]
                except Exception:
                    pass
        return []

    async def classify_promo_links(self, links: list, brand_name: str = "") -> list:
        """Given [{href, text}] same-host links, return the hrefs that lead to
        promo / discount / coupon pages (not products, not categories, not cart)."""
        if not links:
            return []
        chunk = links[:120]
        payload = "\n".join(f"{i}. {l['href']} | {l.get('text', '')[:60]}" for i, l in enumerate(chunk))
        prompt = f"""From this list of links found on "{brand_name or 'a coupon aggregator'}"'s page,
select the ones that lead to pages containing promo codes, coupons, discounts, deals, or vouchers.

EXCLUDE: product pages, categories, cart/checkout, login, about/help pages, blog posts, sitemaps.
A link is "promo" if its URL path or anchor text suggests coupons/codes/deals (e.g. /coupons, /promo-codes,
/deals, /discount, "all coupons", "printable coupons", "today's deals").

Return ONLY a JSON array of the selected URL strings. If none, return [].

{payload}

Selected promo URLs:"""
        result = await self._call(prompt, "You select promo/coupon page links. Reply with JSON only.")
        if not result:
            return []
        try:
            urls = json.loads(result.strip())
            if isinstance(urls, list):
                return [str(u).strip() for u in urls if str(u).strip()]
        except Exception:
            import re
            m = re.search(r'\[.*\]', result, re.S)
            if m:
                try:
                    urls = json.loads(m.group(0))
                    if isinstance(urls, list):
                        return [str(u).strip() for u in urls if str(u).strip()]
                except Exception:
                    pass
        return []

    async def test_connection(self) -> tuple:
        """Return (ok, message). Verifies key + model reachable."""
        try:
            async with httpx.AsyncClient(timeout=20.0) as c:
                r = await c.post(
                    self.endpoint,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={"model": self.model, "messages": [{"role": "user", "content": "ping"}],
                          "max_tokens": 5},
                )
                if r.status_code == 200:
                    return True, "OK"
                return False, f"HTTP {r.status_code}: {r.text[:200]}"
        except Exception as e:
            return False, str(e)[:200]
