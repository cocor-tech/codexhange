"""
AI enrichment worker.
Runs AFTER extraction — never blocks the main pipeline.
Cleans titles, classifies deals, generates tags.

Configuration in MongoDB:
  db.ai_config.findOne() -> { provider, api_key, model, enabled }
"""

import asyncio

from app.services.ai_provider import get_provider, NullProvider

def load_provider(db=None) -> object:
    """Load provider from MongoDB config, falling back to env vars."""
    config = {}
    if db:
        try:
            c = db["ai_config"].find_one({"_id": "global"})
            if c:
                config = c
        except:
            pass

    name = config.get("provider", "") or ""
    key = config.get("api_key", "") or ""
    model = config.get("model", "") or ""
    base_url = config.get("base_url", "") or ""

    return get_provider(name, key, model, base_url)

async def enrich_offer(title: str, description: str = "", provider=None) -> dict:
    if not provider or isinstance(provider, NullProvider):
        return {"title": title, "deal_type": None, "tags": []}

    try:
        cleaned = await provider.summarize_offer(title, description)
        classified = await provider.classify_offer(title, description)
        tags = await provider.generate_tags(title, description)
    except:
        return {"title": title, "deal_type": None, "tags": []}

    return {
        "title": cleaned or title,
        "deal_type": classified or None,
        "tags": tags or [],
    }

async def enrich_batch(offers: list, provider=None) -> list:
    if not offers:
        return []
    results = await asyncio.gather(*[
        enrich_offer(o.get("title", ""), o.get("description", ""), provider)
        for o in offers
    ])
    return [{**o, **r} for o, r in zip(offers, results)]
