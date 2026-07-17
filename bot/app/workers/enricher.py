"""
AI enrichment worker.
Runs AFTER extraction — never blocks the main pipeline.
Cleans titles, classifies deals, generates tags.

Configuration in MongoDB:
  db.ai_config.findOne() -> { provider, api_key, model, enabled }
"""

from app.services.ai_provider import get_provider, NullProvider

async def enrich_offer(title: str, description: str = "", provider=None) -> dict:
    """
    Enrich an offer with AI.
    Returns dict with cleaned_title, deal_type, tags.
    If AI fails or is not configured, returns originals.
    """
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
    """Enrich multiple offers. Never raises."""
    results = []
    for offer in offers:
        result = await enrich_offer(
            offer.get("title", ""),
            offer.get("description", ""),
            provider,
        )
        results.append({**offer, **result})
    return results
