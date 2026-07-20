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
            async with httpx.AsyncClient(timeout=10.0) as c:
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
