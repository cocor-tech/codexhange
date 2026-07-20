from datetime import datetime, timezone
from app.models.deal import Deal
from app.services.classifier import classify, clean_code
from app.extractors import extract_expiry

def build_document(deal: Deal, service_id, brand: dict) -> dict:
    validated_code = clean_code(deal.code)
    assigned_type = classify(deal.title, deal.description or "", validated_code)
    now = datetime.now(timezone.utc)
    confidence = deal.confidence_score
    combined = f"{deal.title} {deal.description or ''}"
    expires_at = extract_expiry(combined)

    doc = {
        "serviceId": service_id,
        "deal_type": assigned_type,
        "type": "promo_code" if assigned_type == "code" else assigned_type,
        "title": deal.title[:200],
        "code": validated_code,
        "discount": deal.discount_value or "",
        "description": (deal.description or "")[:500],
        "sourceUrl": deal.destination_url,
        "sourcePage": deal.source_page,
        "sourceReliability": "Official Site",
        "countries": deal.countries or [],
        "confidence": confidence,
        "status": "published",
        "verifiedBy": "bot",
        "verifiedAt": now,
        "upvotes": 0, "downvotes": 0, "clicks": 0,
        "createdAt": now, "updatedAt": now, "lastSeenAt": now,
        "store_slug": brand.get("slug", ""),
        "strategy": deal.strategy,
        "store_name": deal.store_name,
        "expiresAt": expires_at,
    }
    if expires_at and expires_at <= now:
        doc["status"] = "expired"
    return doc

def upsert_offer(db, doc: dict, service_id, source_url: str):
    db.offers.update_one(
        {"serviceId": service_id, "sourceUrl": source_url},
        {"$set": {k: v for k, v in doc.items() if k not in ("createdAt",)}},
        upsert=True,
    )

def insert_blocked(db, service_id, url: str, reason: str, store_name: str = ""):
    now = datetime.now(timezone.utc)
    db.offers.update_one(
        {"serviceId": service_id, "sourceUrl": url},
        {"$set": {
            "status": "blocked", "blocked_reason": reason,
            "sourceUrl": url, "updatedAt": now, "store_name": store_name,
        }},
        upsert=True,
    )
