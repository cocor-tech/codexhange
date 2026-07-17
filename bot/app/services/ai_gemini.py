"""
Gemini provider for AI enrichment.
Uses the free tier of Google Gemini API.
https://ai.google.dev/gemini-api/docs

Configuration:
  AI_PROVIDER=gemini
  AI_API_KEY=<your-gemini-api-key>
  AI_MODEL=gemini-2.0-flash (default, free tier)
"""

import httpx
import json
from typing import Optional

API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

class GeminiProvider:
    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self.api_key = api_key
        self.model = model
        self.endpoint = f"{API_BASE}/{model}:generateContent"

    async def _call(self, prompt: str, system_instruction: str = "") -> Optional[str]:
        if not self.api_key:
            return None
        try:
            body = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 200,
                }
            }
            if system_instruction:
                body["systemInstruction"] = {"parts": [{"text": system_instruction}]}

            async with httpx.AsyncClient(timeout=10.0) as c:
                r = await c.post(
                    f"{self.endpoint}?key={self.api_key}",
                    headers={"Content-Type": "application/json"},
                    json=body,
                )
                if r.status_code != 200:
                    return None
                data = r.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    return None
                return candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        except:
            return None

    async def summarize_offer(self, title: str, description: str = "") -> str:
        """Clean up title — remove noise, keep the actual offer"""
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
        """Classify as: code, sale, free_trial, student_discount, referral"""
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
        """Generate 3-5 tags/keywords for the offer"""
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
