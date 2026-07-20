"""
AI Provider abstraction for offer enrichment.
Never sits in the critical path — runs after extraction.

Usage:
    provider = get_provider("gemini", api_key="...")
    summary = await provider.summarize_offer(title, description)

Available implementations:
    - GeminiProvider (free tier)
    - OpenAIProvider (works with Groq, OpenAI, Together, etc.)
    - HuggingFaceProvider (TODO)
    - OllamaProvider (TODO)
"""

from typing import Protocol, Optional
from app.config.settings import AI_PROVIDER, AI_API_KEY, AI_MODEL, AI_BASE_URL

class AIProvider(Protocol):
    async def summarize_offer(self, title: str, description: str) -> str: ...
    async def classify_offer(self, title: str, description: str) -> str: ...
    async def generate_tags(self, title: str, description: str) -> list: ...

class NullProvider:
    async def summarize_offer(self, title: str, description: str = "") -> str:
        return title
    async def classify_offer(self, title: str, description: str = "") -> str:
        from app.services.classifier import classify
        return classify(title, description, None)
    async def generate_tags(self, title: str, description: str = "") -> list:
        return []

def get_provider(provider_name: str = "", api_key: str = "", model: str = "", base_url: str = "") -> AIProvider:
    name = (provider_name or AI_PROVIDER).lower()
    key = api_key or AI_API_KEY
    mdl = model or AI_MODEL
    url = base_url

    if name == "gemini" and key:
        from app.services.ai_gemini import GeminiProvider
        return GeminiProvider(key, mdl or "gemini-2.0-flash")

    if name in ("openai", "groq") and key:
        from app.services.ai_openai import OpenAIProvider
        if not url:
            if name == "groq":
                url = "https://api.groq.com/openai/v1"
            else:
                url = "https://api.openai.com/v1"
        return OpenAIProvider(key, mdl or "gpt-4o-mini", url)

    return NullProvider()
