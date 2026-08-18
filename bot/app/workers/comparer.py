"""
Cross-source offer comparison worker.

For every brand, gather candidate offers discovered from ALL sources, group
them by normalized code, and score them:
  - heuristic: a code found on 2+ different sites is corroborated -> confidence +10
  - AI (when configured): scores every candidate (validity + quality 0-100) and
    picks the best one per code group; weaker duplicates are archived with a
    reference to the winner.

Used by: `python main.py --compare` and automatically after source discovery
when an AI provider is configured.
"""
import asyncio
import json
import re
from datetime import datetime, timezone

from app.services.ai_provider import NullProvider

ARCHIVED_STATUSES = ("blocked", "expired", "archived")


def normalize_code(code) -> str:
    if not code:
        return ""
    c = str(code).strip().upper()
    return re.sub(r"[\s\-_]+", "", c)


def _clean_candidates(offers: list, max_per_group: int = 8) -> list:
    """Build the candidate payload the AI scores."""
    out = []
    for o in offers:
        out.append({
            "_id": str(o["_id"]),
            "code": o.get("code") or "",
            "title": (o.get("title") or "")[:120],
            "discount": (o.get("discount") or "")[:40],
            "description": (o.get("description") or "")[:200],
            "sourceUrl": (o.get("sourceUrl") or "")[:120],
            "sourceReliability": o.get("sourceReliability", ""),
            "strategy": o.get("strategy", ""),
            "confidence": o.get("confidence", 0),
        })
    return out[:max_per_group]


async def _ai_score_candidates(provider, store_name: str, candidates: list) -> list:
    """Return [{code, score, verdict, reason}] from the AI provider."""
    if not candidates or isinstance(provider, NullProvider):
        return []
    payload = "\n".join(
        f"- {c['code']} | {c['title']} | {c['discount']} | {c['sourceUrl']}"
        for c in candidates
    )
    prompt = f"""You are a coupon verification expert for "{store_name}".

Compare these promo codes found on DIFFERENT coupon websites for the same store.
For each code, score it 0-100 for how likely it is to be a real, currently working
promo code (not a fake, random string, or obviously expired deal).

Verdicts: valid, expired, unlikely, duplicate.

Return ONLY a JSON array, one object per code:
[{{"code": "SAVE20", "score": 87, "verdict": "valid", "reason": "20% off confirmed on 3 sites"}}]

Codes:
{payload}

JSON:"""
    try:
        raw = await provider._call(prompt)
    except Exception:
        return []
    if not raw:
        return []
    try:
        data = json.loads(raw.strip())
    except Exception:
        m = re.search(r"\[.*\]", raw, re.S)
        if not m:
            return []
        try:
            data = json.loads(m.group(0))
        except Exception:
            return []
    if not isinstance(data, list):
        return []
    out = []
    for d in data:
        if not isinstance(d, dict) or not d.get("code"):
            continue
        out.append({
            "code": str(d["code"]).strip().upper(),
            "score": min(max(int(d.get("score", 50)), 0), 100),
            "verdict": str(d.get("verdict", "unlikely"))[:20],
            "reason": str(d.get("reason", ""))[:200],
        })
    return out


async def compare_offers_for_brand(db, provider, store_name: str, limit: int = 60) -> dict:
    """Score + dedupe all offers for one brand across every source."""
    now = datetime.now(timezone.utc)
    offers = list(db.offers.find({
        "store_name": store_name,
        "status": {"$nin": list(ARCHIVED_STATUSES)},
    }).limit(limit))
    if not offers:
        return {"store_name": store_name, "offers": 0, "groups": 0, "archived": 0}

    # -- rescore EVERY offer with the weighted ranking model --
    from app.services.ranking import rank_offer, corroboration_count
    sources = {}
    try:
        for src in db["sources"].find({}):
            base = (src.get("url") or "").rstrip("/")
            if base:
                sources[base] = src
    except Exception:
        pass
    ranked = 0
    for o in offers:
        count = corroboration_count(offers, o.get("code") or "")
        source = None
        for base, src in sources.items():
            if (o.get("sourcePage") or "").startswith(base):
                source = src
                break
        new_conf = rank_offer(o, count, source, now)
        if new_conf != (o.get("confidence") or 0):
            db.offers.update_one({"_id": o["_id"]}, {
                "$set": {"confidence": new_conf, "corroborationCount": count, "rankedAt": now}})
        o["confidence"] = new_conf
        ranked += 1

    groups = {}
    for o in offers:
        key = normalize_code(o.get("code"))
        if not key:
            continue
        groups.setdefault(key, []).append(o)

    ai_scores = {}
    for key, members in groups.items():
        if len(members) < 2:
            continue
        cands = _clean_candidates(members)
        scored = await _ai_score_candidates(provider, store_name, cands)
        for s in scored:
            if s["code"] == key:
                ai_scores[key] = s

    archived = 0
    for key, members in groups.items():
        if len(members) < 2:
            continue
        ai = ai_scores.get(key, {})
        # corroboration: same code found on multiple sites boosts confidence
        if len({m.get("sourceUrl", "") for m in members}) >= 2:
            for m in members:
                m["_corroborated"] = True

        def rank(m):
            base = m.get("confidence", 0) or 0
            if m.get("_corroborated"):
                base += 10
            if ai.get("code") == key:
                base += ai.get("score", 0) / 10
            return base

        members.sort(key=rank, reverse=True)
        winner = members[0]
        winner_id = str(winner["_id"])
        winner_set = {
            "confidence": min(rank(winner), 99),
            "crossCheckedAt": now,
        }
        if ai.get("code") == key:
            winner_set["aiScore"] = ai.get("score")
            winner_set["aiVerdict"] = ai.get("verdict")
            winner_set["aiReason"] = ai.get("reason")
        if winner.get("_corroborated"):
            winner_set["corroborated"] = True
        if winner.get("status") != "published":
            winner_set["status"] = "published"
        db.offers.update_one({"_id": winner["_id"]}, {"$set": winner_set})

        for d in members[1:]:
            db.offers.update_one({"_id": d["_id"]}, {"$set": {
                "status": "archived",
                "archivedAt": now,
                "mergedInto": winner_id,
                "crossCheckedAt": now,
                "archivedReason": "duplicate_cross_source",
            }})
            archived += 1

    return {
        "store_name": store_name,
        "offers": len(offers),
        "groups": len(groups),
        "archived": archived,
        "ranked": ranked,
    }


async def compare_all_brands(db, provider, limit_brands: int = 40, concurrency: int = 5) -> dict:
    """Compare offers for the most active brands (most offers across sources)."""
    brands = list(db.offers.aggregate([
        {"$match": {"status": {"$nin": list(ARCHIVED_STATUSES)}, "store_name": {"$ne": ""}}},
        {"$group": {"_id": "$store_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit_brands},
    ]))
    sem = asyncio.Semaphore(concurrency)

    async def run(b):
        async with sem:
            try:
                return await compare_offers_for_brand(db, provider, b["_id"])
            except Exception as e:
                return {"store_name": b["_id"], "error": str(e)[:120]}

    results = await asyncio.gather(*[run(b) for b in brands])
    total = {"brands": len(results), "offers": 0, "archived": 0}
    for r in results:
        total["offers"] += r.get("offers", 0)
        total["archived"] += r.get("archived", 0)
    return total