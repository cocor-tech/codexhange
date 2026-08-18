"""
Offer ranking service.

Every published offer gets a 0-99 score stored in `confidence`, recomputed on
each compare run. Signals (weighted, no hardcoded site lists — all data-driven):

  - base confidence (as discovered)
  - corroboration: same code seen on N different sources       (+up to 16)
  - AI score: the cross-source AI verdict 0-100                (+up to 10)
  - recency: days since last confirmed scan                    (decay up to -20)
  - expiry proximity: expiresAt within 3/7/14 days             (-25 / -15 / -5)
  - discount strength: % off / free shipping / cashback        (+up to 12)
  - source health: measured productivity + speed of the source (+up to 10)
  - user rating: community star rating 1-5                     (+up to 15)

Reuses the existing `confidence` field — the frontend already sorts by it.
"""
import re
from datetime import datetime, timezone

PCT_RE = re.compile(r"(\d{1,3})\s*%", re.I)


def discount_strength(discount: str) -> float:
    """+min(pct/4, 12); free shipping +6; cashback +6."""
    if not discount:
        return 0.0
    t = discount.lower()
    m = PCT_RE.search(t)
    if m:
        return min(int(m.group(1)) / 4.0, 12.0)
    if "free shipping" in t:
        return 6.0
    if "cashback" in t or "cash back" in t:
        return 6.0
    return 0.0


def source_health_bonus(source: dict = None) -> float:
    """Reliability derived from the source's measured stats (scanLevel,
    avgScanTime, offers_found). Tier 3 = fast + productive -> +10."""
    if not source:
        return 0.0
    level = int(source.get("scanLevel") or 0)
    avg = float(source.get("avgScanTime") or 999)
    found = int((source.get("stats") or {}).get("offers_found") or 0)
    if level == 1 and avg < 8:
        return 10.0
    if level == 1 or found >= 100:
        return 6.0
    if level == 2 or avg < 20:
        return 4.0
    if found >= 10:
        return 2.0
    return 1.0


def expiry_penalty(expires_at, now) -> float:
    if not expires_at:
        return 0.0
    try:
        days = (expires_at - now).total_seconds() / 86400
    except Exception:
        return 0.0
    if days < 0:
        return 30.0
    if days < 3:
        return 25.0
    if days < 7:
        return 15.0
    if days < 14:
        return 5.0
    return 0.0


def rank_offer(offer: dict, corroboration_count: int = 0,
               source: dict = None, now=None) -> int:
    """Score one offer 0-99. `offer` is a Mongo doc; missing fields default safely."""
    now = now or datetime.now(timezone.utc)
    base = int(offer.get("confidence") or 50)
    corroboration_count = corroboration_count or 0

    score = float(base)

    if corroboration_count >= 2:
        score += min(10.0 + (corroboration_count - 2) * 2.0, 16.0)

    score += min(float(offer.get("aiScore") or 0) / 10.0, 10.0)

    last = offer.get("lastSeenAt") or offer.get("verifiedAt") or offer.get("updatedAt")
    if last:
        try:
            days = (now - last).total_seconds() / 86400
            if days >= 1:
                score -= min(days * 1.5, 20.0)  # staleness decay
            else:
                score += 5.0                    # freshly confirmed boost
        except Exception:
            pass

    score -= expiry_penalty(offer.get("expiresAt"), now)

    score += discount_strength(offer.get("discount") or "")

    score += source_health_bonus(source)

    avg = float(offer.get("avgRating") or 0)
    if avg:
        score += min(avg * 3.0, 15.0)

    return max(0, min(round(score), 99))


def corroboration_count(offers: list, code: str) -> int:
    """Distinct sourceUrls carrying the same normalized code across offers."""
    if not code:
        return 0
    n = code.strip().upper()
    return len({(o.get("sourceUrl") or "") for o in offers
                if (o.get("code") or "").strip().upper() == n and o.get("sourceUrl")})