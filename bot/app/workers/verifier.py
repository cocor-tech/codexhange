"""
Offer re-verification worker.

When a source is re-crawled, every published offer discovered from it is
re-checked against 5 signals:

  1. page_ok            - the source page still returns 200 (not 404/blocked)
  2. code_present       - the code still appears on the source page
  3. link_alive         - the outbound "Shop Now"/"Get Code" link still resolves
                          to a real merchant URL (not dead / redirect domain)
  4. merchant_has_promo - the merchant site still shows discount/promo content
  5. expiry_passed      - the stored expiry date has passed

Each offer stores a `verification` report: healthScore /5 (only checks that
could actually be evaluated count; blocked/flaky fetches are marked "unknown"
and never count as a failure) + per-check booleans + reasons.

Expiry policy (flaky-guard): a scan only counts as a "miss" when the source
page itself was fetched successfully and the code is genuinely absent or the
link is dead. A blocked/timeout/error scan never counts. An offer is soft-
expired (status="expired", kept in DB for audit) after 2 consecutive confirmed
misses, or immediately when its expiry date has passed.
"""
import asyncio
from datetime import datetime, timezone

from app.services.resolver import resolve_final_url, is_redirect_domain
from app.workers.scanner import scan_source

MERCHANT_PROMO_RE = [
    "discount", "% off", "save", "sale", "promo", "coupon", "code",
    "deal", "voucher", "cashback", "free shipping", "special offer",
]


def _norm(s: str) -> str:
    return "".join(ch for ch in (s or "").upper() if ch.isalnum())


async def _page_ok(scan: dict) -> dict:
    ok = bool(scan.get("success")) and not scan.get("blocked") and scan.get("status") == 200
    return {"ok": ok, "reason": scan.get("error") or scan.get("blocked_reason") or ""}


async def _code_present(scan: dict, code: str) -> dict:
    if not code:
        return {"ok": None, "reason": "offer has no code"}
    ncode = _norm(code)
    if not ncode:
        return {"ok": None, "reason": "code unnormalizable"}
    for c in scan.get("codes") or []:
        if _norm(c) == ncode:
            return {"ok": True, "reason": "found in extracted codes"}
    text = (scan.get("title") or "") + " " + (scan.get("page_text") or "")
    if ncode in _norm(text):
        return {"ok": True, "reason": "found in page text"}
    return {"ok": False, "reason": "code not on page"}


async def _link_alive(client, offer: dict) -> dict:
    url = offer.get("destination_url") or offer.get("sourceUrl") or ""
    if not url:
        return {"ok": None, "reason": "no destination URL"}
    try:
        res = await resolve_final_url(client, url)
        if not res.get("ok"):
            return {"ok": False, "reason": "link does not resolve"}
        if is_redirect_domain(res.get("domain", "")):
            return {"ok": False, "reason": f"still lands on redirect domain {res['domain']}"}
        return {"ok": True, "reason": f"resolves to {res['domain']}"}
    except Exception as e:
        return {"ok": None, "reason": f"check failed: {str(e)[:60]}"}


async def _merchant_has_promo(client, offer: dict) -> dict:
    url = offer.get("destination_url") or offer.get("sourceUrl") or ""
    if not url:
        return {"ok": None, "reason": "no merchant URL"}
    try:
        from app.services.fetcher import smart_fetch
        fr = await smart_fetch(client, url, timeout=5.0)
        if fr.get("blocked"):
            return {"ok": None, "reason": "merchant blocked (cloudflare)"}
        if fr.get("status") != 200:
            return {"ok": False, "reason": f"merchant HTTP {fr['status']}"}
        text = (fr.get("text") or "")
        if len(text) < 300:
            return {"ok": None, "reason": "merchant page too short to judge"}
        low = text.lower()
        hits = [k for k in MERCHANT_PROMO_RE if k in low]
        if hits:
            return {"ok": True, "reason": "promo content: " + ", ".join(hits[:3])}
        return {"ok": False, "reason": "no discount/promo content on merchant page"}
    except Exception as e:
        return {"ok": None, "reason": f"check failed: {str(e)[:60]}"}


async def verify_offer(db, client, offer: dict, now=None) -> dict:
    """Re-check one offer against all 5 signals; returns the verification report
    (already persisted). Soft-expires the offer when it fails twice."""
    now = now or datetime.now(timezone.utc)

    page = offer.get("sourcePage") or offer.get("sourceUrl") or ""
    scan = await scan_source(client, page, offer.get("store_name") or "")

    checks = {
        "page_ok": await _page_ok(scan),
        "code_present": await _code_present(scan, offer.get("code") or ""),
        "link_alive": await _link_alive(client, offer),
        "merchant_has_promo": await _merchant_has_promo(client, offer),
    }
    expires_at = offer.get("expiresAt")
    if expires_at and expires_at <= now:
        checks["expiry_passed"] = {"ok": True, "reason": "stored expiry date passed"}
    elif expires_at:
        checks["expiry_passed"] = {"ok": False, "reason": "expiry date still in future"}
    else:
        checks["expiry_passed"] = {"ok": None, "reason": "offer has no stored expiry date"}

    # health = passed / evaluable (unknown checks excluded)
    evaluable = [c for c in checks.values() if c.get("ok") is not None]
    passed = sum(1 for c in evaluable if c["ok"])
    health = round(passed / len(evaluable) * 5) if evaluable else 0
    # a missing code is a dead deal no matter how healthy the links are
    if checks["code_present"]["ok"] is False:
        health = min(health, 2)
    if checks["expiry_passed"]["ok"]:
        health = min(health, 1)

    prev_misses = int(offer.get("verification", {}).get("consecutiveMisses") or 0)
    confirmed_miss = bool(checks["page_ok"]["ok"] and not checks["code_present"]["ok"])
    if confirmed_miss:
        misses = prev_misses + 1
    else:
        misses = 0

    report = {
        "healthScore": health,
        "checks": {k: {"ok": v["ok"], "reason": v["reason"]} for k, v in checks.items()},
        "consecutiveMisses": misses,
        "checkedAt": now,
    }

    expired = checks["expiry_passed"]["ok"]
    reason = "expiry_date_passed" if expired else ""
    if not expired and confirmed_miss and misses >= 2:
        expired = True
        reason = "not_found_on_source"

    if expired:
        report["expiredAt"] = now
        report["expiredReason"] = reason
        db.offers.update_one({"_id": offer["_id"]}, {"$set": {
            "status": "expired",
            "archivedAt": now,
            "archivedReason": reason,
            "verification": report,
            "updatedAt": now,
        }})
    else:
        db.offers.update_one({"_id": offer["_id"]}, {"$set": {
            "verification": report,
            "lastSeenAt": now,
            "updatedAt": now,
        }})

    return report


async def reverify_source(db, client, source: dict, concurrency: int = 4) -> dict:
    """Re-verify all published offers discovered from one source."""
    base = (source.get("url") or "").rstrip("/")
    if not base:
        return {"source": "", "checked": 0, "expired": 0}
    offers = list(db.offers.find({
        "sourcePage": {"$regex": "^" + base.replace(".", r"\.")},
        "status": "published",
    }).limit(300))
    if not offers:
        return {"source": source.get("name") or base, "checked": 0, "expired": 0}

    sem = asyncio.Semaphore(concurrency)

    async def run(o):
        async with sem:
            try:
                rep = await verify_offer(db, client, o)
                return rep.get("expiredReason") == "not_found_on_source" or rep.get("expiredReason") == "expiry_date_passed"
            except Exception:
                return False

    results = await asyncio.gather(*[run(o) for o in offers])
    expired = sum(1 for r in results if r)
    return {"source": source.get("name") or base, "checked": len(offers), "expired": expired}


async def reverify_all(db, client, sources=None, concurrency: int = 4) -> dict:
    """Re-verify offers across all (or the given) active sources."""
    if sources is None:
        sources = list(db["sources"].find({"status": "active"}))
    total = {"sources": len(sources), "checked": 0, "expired": 0}
    sem = asyncio.Semaphore(2)

    async def run(src):
        async with sem:
            try:
                r = await reverify_source(db, client, src, concurrency)
                total["checked"] += r["checked"]
                total["expired"] += r["expired"]
            except Exception:
                pass

    await asyncio.gather(*[run(s) for s in sources])
    return total