"""
Full scan of ALL 20K+ promocodes.com stores with pause/continue support.
Saves progress to MongoDB after every batch.
Check pause flag before each batch.
"""

import asyncio, httpx, re, json, os, sys, time
from pymongo import MongoClient
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.adapters.promocodes import PromoCodesAdapter
from app.publishers.mongo import build_document
from app.models.deal import Deal

MONGO_URI = os.getenv("MONGODB_URI", "")
if not MONGO_URI:
    for path in ["/root/codexhange/.env", ".env"]:
        if os.path.exists(path):
            with open(path) as f:
                for line in f:
                    if line.startswith("MONGODB_URI="):
                        MONGO_URI = line.split("=", 1)[1].strip().strip("'\"")

BATCH_SIZE = 10
SLUG_CACHE = "/tmp/codexhange_slugs.json"

async def get_all_slugs() -> list:
    """Fetch and cache all store slugs from sitemap."""
    if os.path.exists(SLUG_CACHE):
        with open(SLUG_CACHE) as f:
            cached = json.load(f)
            if time.time() - cached.get("ts", 0) < 86400:
                return cached["slugs"]
    async with httpx.AsyncClient(timeout=30.0) as c:
        r = await c.get("https://www.promocodes.com/sitemap-stores.xml",
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
    urls = re.findall(r'<loc>(.*?)</loc>', r.text)
    slugs = sorted(set(u.replace("https://www.promocodes.com/", "").replace("-coupons", "").rstrip("/") for u in urls))
    with open(SLUG_CACHE, "w") as f:
        json.dump({"ts": time.time(), "slugs": slugs}, f)
    return slugs

async def is_paused(db) -> bool:
    """Check if scan should pause."""
    c = db.scan_progress.find_one({"_id": "full_scan"})
    return c.get("paused", False) if c else False

async def save_progress(db, done, total, offers, eta, status="running"):
    db.scan_progress.update_one(
        {"_id": "full_scan"},
        {"$set": {
            "done": done, "total": total, "offers": offers,
            "eta_min": round(eta, 1), "status": status,
            "paused": False, "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

async def scan_slug(slug: str, db) -> int:
    adapter = PromoCodesAdapter()
    name = slug.replace("-", " ").title()
    brand_data = {"brandName": name, "slug": slug, "website": f"https://{slug}.com"}
    try:
        results = await adapter.discover(brand_data)
        if not results:
            return 0
        now = datetime.now(timezone.utc)
        for rd in results:
            deal = Deal(
                store_name=name,
                deal_type=rd.get("deal_type", "sale"),
                code=rd.get("code"),
                title=str(rd.get("title", f"{name} Offer")),
                description=str(rd.get("description", "")),
                destination_url=str(rd["sourceUrl"]),
                source_page=str(rd.get("sourcePage", "")),
                confidence_score=min(int(rd.get("confidence", 50)), 99),
                strategy="full_scan",
                countries=rd.get("countries", []),
                discount_value=str(rd.get("discount", "")),
            )
            doc = build_document(deal, "full_scan", {"slug": slug, "name": name})
            doc["store_name"] = name
            doc["websiteId"] = f"fs_{slug}"
            db.offers.update_one(
                {"store_name": name, "sourceUrl": rd["sourceUrl"]},
                {"$set": {k: v for k, v in doc.items() if k != "createdAt"}},
                upsert=True,
            )
        return len(results)
    except Exception as e:
        return 0

async def scan_batch(slugs: list, db) -> int:
    """Scan a batch of slugs, return found count."""
    found = 0
    async with httpx.AsyncClient(timeout=10.0) as c:
        checks = await asyncio.gather(*[
            _check_slug(s, c) for s in slugs
        ], return_exceptions=True)
    
    valid = [s for s, ok in zip(slugs, checks) if ok is True]
    
    for slug in valid:
        count = await scan_slug(slug, db)
        if count:
            found += count
            print(f"  + {slug}: {count} offers")
        await asyncio.sleep(0.5)
    
    return found

async def _check_slug(slug: str, client: httpx.AsyncClient) -> bool:
    try:
        r = await client.get(f"https://www.promocodes.com/{slug}",
            headers={"User-Agent": "Mozilla/5.0"}, timeout=6.0)
        return r.status_code == 200
    except:
        return False

async def main():
    client = MongoClient(MONGO_URI)
    db = client.get_database()

    # Load existing progress
    existing = db.scan_progress.find_one({"_id": "full_scan"})
    start_from = existing.get("done", 0) if existing else 0
    status = existing.get("status", "") if existing else ""

    # If status is "complete" or "idle", start fresh
    if status in ("complete", "idle"):
        start_from = 0

    print(f"Resuming from index {start_from}")

    all_slugs = await get_all_slugs()
    total = len(all_slugs)
    print(f"Total stores: {total}")

    found_offers = db.offers.count_documents({"status": "published"})
    start_time = time.time()

    for i in range(start_from, total, BATCH_SIZE):
        # Check pause
        if await is_paused(db):
            await save_progress(db, i, total, found_offers, 0, "paused")
            print(f"Paused at {i}/{total}")
            client.close()
            return

        batch = all_slugs[i:i+BATCH_SIZE]
        count = await scan_batch(batch, db)
        if count:
            found_offers = db.offers.count_documents({"status": "published"})

        # Save progress
        elapsed = time.time() - start_time
        rate = (i + BATCH_SIZE) / elapsed if elapsed > 0 else 1
        eta = (total - i - BATCH_SIZE) / rate if rate > 0 else 0
        await save_progress(db, i + BATCH_SIZE, total, found_offers, eta / 60)

        print(f"Progress: {i+BATCH_SIZE}/{total} | Offers: {found_offers} | ETA: {eta/60:.1f}min")

    # Complete
    found_offers = db.offers.count_documents({"status": "published"})
    await save_progress(db, total, total, found_offers, 0, "complete")
    print(f"\nComplete! Total published offers: {found_offers}")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
