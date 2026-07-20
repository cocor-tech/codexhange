"""
Full scan of ALL 20K+ promocodes.com stores.
Runs in batches of 10 with 1s delay between each to avoid rate limiting.
Estimated time: 20K stores × ~3s per store = ~16 hours.
Logs progress and can be resumed.
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
DELAY = 1.0
PROGRESS_FILE = "/tmp/codexhange_scan_progress.txt"

async def get_all_slugs() -> list:
    async with httpx.AsyncClient(timeout=30.0) as c:
        r = await c.get("https://www.promocodes.com/sitemap-stores.xml",
            headers={"User-Agent": "Mozilla/5.0"})
    urls = re.findall(r'<loc>(.*?)</loc>', r.text)
    slugs = list(set(u.replace("https://www.promocodes.com/", "").replace("-coupons", "").rstrip("/") for u in urls))
    return sorted(slugs)

async def check_slug(slug: str, client: httpx.AsyncClient) -> bool:
    try:
        r = await client.get(f"https://www.promocodes.com/{slug}",
            headers={"User-Agent": "Mozilla/5.0"}, timeout=6.0)
        return r.status_code == 200
    except:
        return False

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
    except:
        return 0

async def main():
    client = MongoClient(MONGO_URI)
    db = client.get_database()

    # Load progress
    start_from = 0
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            start_from = int(f.read().strip())
        print(f"Resuming from index {start_from}")

    all_slugs = await get_all_slugs()
    print(f"Total stores to scan: {len(all_slugs)}")

    total_found = 0
    done = 0

    for i in range(start_from, len(all_slugs), BATCH_SIZE):
        batch = all_slugs[i:i+BATCH_SIZE]
        
        # Quick check which slugs are valid
        async with httpx.AsyncClient(timeout=10.0) as c:
            checks = await asyncio.gather(*[check_slug(s, c) for s in batch])
        
        valid = [s for s, ok in zip(batch, checks) if ok]
        
        for slug in valid:
            count = await scan_slug(slug, db)
            if count:
                total_found += count
                print(f"  [{done}] {slug}: {count} offers")
            await asyncio.sleep(0.3)
            done += 1

        done += len(batch) - len(valid)

        # Save progress every 50
        if (i + BATCH_SIZE) % 50 == 0:
            total_offers = db.offers.count_documents({"status": "published"})
            elapsed = time.time() - start_time
            rate = (i + BATCH_SIZE) / elapsed if elapsed > 0 else 0
            remaining = (len(all_slugs) - i - BATCH_SIZE) / rate if rate > 0 else 0
            db.scan_progress.update_one(
                {"_id": "full_scan"},
                {"$set": {
                    "total": len(all_slugs), "done": i + BATCH_SIZE,
                    "offers": total_offers, "status": "running",
                    "eta_min": round(remaining / 60, 1),
                    "updated_at": datetime.now(timezone.utc),
                }},
                upsert=True,
            )
            print(f"\nProgress: {i+BATCH_SIZE}/{len(all_slugs)} | Found: {total_offers} offers | ETA: {remaining/60:.1f}min\n")

    # Final
    with open(PROGRESS_FILE, "w") as f:
        f.write(str(len(all_slugs)))
    total = db.offers.count_documents({"status": "published"})
    print(f"\nComplete! Total published offers: {total}")
    client.close()

start_time = time.time()
if __name__ == "__main__":
    asyncio.run(main())
