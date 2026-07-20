"""
Targeted scan — checks all 20K promocodes slugs but only scans ones with 200 status.
Batch size: 50 checks at once, then scan valid ones.
Daily cron at 3am.
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

SLUG_CACHE = "/tmp/codexhange_slugs.json"

async def get_all_slugs() -> list:
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

async def save_progress(db, valid_count, offers_count):
    db.scan_progress.update_one(
        {"_id": "targeted_scan"},
        {"$set": {
            "valid_stores": valid_count,
            "offers": offers_count,
            "status": "complete",
            "updated_at": datetime.now(timezone.utc),
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
                strategy="targeted",
                countries=rd.get("countries", []),
                discount_value=str(rd.get("discount", "")),
            )
            doc = build_document(deal, "targeted", {"slug": slug, "name": name})
            doc["store_name"] = name
            doc["websiteId"] = f"tg_{slug}"
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

    all_slugs = await get_all_slugs()
    print(f"Total slugs: {len(all_slugs)}")

    # Get existing brands from DB to prioritize
    existing = set(db.offers.distinct("store_name"))
    existing_slugs = {s.lower().replace(" ", "-").replace("'", "").replace(".", "") for s in existing}

    # Prioritize existing brands + popular ones
    popular = ["nike","walmart","amazon","target","best-buy","costco","samsung","apple","sony","dell",
               "lenovo","hp","acer","asus","adidas","puma","converse","vans","levi","under-armour",
               "sephora","ulta-beauty","chewy","petsmart","petco","wayfair","ikea","kohls","macys",
               "nordstrom","gap","oldnavy","victorias-secret","boohoo","asos","zara","hm","uniqlo",
               "kayak","expedia","hotels-com","priceline","orbitz","hertz","avis","enterprise",
               "booking-com","agoda","trip-com","vrbo","logitech","razer","corsair","anker",
               "dji","oneplus","xiaomi","nikon","canon","bose","jbl","sony","samsung",
               "starbucks","mcdonalds","burger-king","kfc","pizza-hut","dominos","subway",
               "taco-bell","chipotle","panera","popeyes","wendys","dunkin","krispy-kreme"]

    # Check all slugs in batches, report valid ones
    valid_slugs = []
    batch_size = 100
    for i in range(0, len(all_slugs), batch_size):
        batch = all_slugs[i:i+batch_size]
        async with httpx.AsyncClient(timeout=10.0) as c:
            tasks = []
            for slug in batch:
                tasks.append(_check(slug, c))
            results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for slug, ok in zip(batch, results):
            if ok is True:
                valid_slugs.append(slug)
        
        # Progress
        if (i + batch_size) % 1000 == 0:
            print(f"Checked {i+batch_size}/{len(all_slugs)}, valid so far: {len(valid_slugs)}")

    print(f"\nValid stores: {len(valid_slugs)}")
    
    # Now scan valid slugs — prioritize existing + popular first
    priority = [s for s in valid_slugs if s in existing_slugs or s in popular]
    rest = [s for s in valid_slugs if s not in priority]
    scan_order = priority + rest

    total_found = 0
    for idx, slug in enumerate(scan_order):
        count = await scan_slug(slug, db)
        if count:
            total_found += count
            print(f"  {slug}: {count} offers")
        await asyncio.sleep(0.3)

        # Save progress
        if (idx + 1) % 20 == 0:
            offers = db.offers.count_documents({"status": "published"})
            db.scan_progress.update_one(
                {"_id": "targeted_scan"},
                {"$set": {
                    "scanned": idx + 1, "total": len(scan_order),
                    "valid_stores": len(valid_slugs), "offers": offers,
                    "status": "running", "updated_at": datetime.now(timezone.utc),
                }},
                upsert=True,
            )

    offers = db.offers.count_documents({"status": "published"})
    await save_progress(db, len(valid_slugs), offers)
    print(f"\nComplete! Valid stores: {len(valid_slugs)}, Offers: {offers}")
    client.close()

async def _check(slug: str, client: httpx.AsyncClient):
    try:
        r = await client.get(f"https://www.promocodes.com/{slug}",
            headers={"User-Agent": "Mozilla/5.0"}, timeout=5.0)
        return r.status_code == 200
    except:
        return False

if __name__ == "__main__":
    asyncio.run(main())
