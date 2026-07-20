"""
Hourly scan — checks 15 brands per run from promocodes.com.
Runs every hour to refresh offers and discover new ones.
"""

import asyncio, re, json, httpx, os, sys
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

BATCH_SIZE = 15

async def scan_brand(slug: str, store_name: str, db) -> int:
    adapter = PromoCodesAdapter()
    brand_data = {"brandName": store_name, "slug": slug, "website": f"https://{slug}.com"}
    results = await adapter.discover(brand_data)
    if not results:
        return 0

    now = datetime.now(timezone.utc)
    submitted = 0
    for rd in results:
        deal = Deal(
            store_name=store_name,
            deal_type=rd.get("deal_type", "sale"),
            code=rd.get("code"),
            title=str(rd.get("title", f"{store_name} Offer")),
            description=str(rd.get("description", "")),
            destination_url=str(rd["sourceUrl"]),
            source_page=str(rd.get("sourcePage", "")),
            confidence_score=min(int(rd.get("confidence", 50)), 99),
            strategy="hourly",
            countries=rd.get("countries", []),
            discount_value=str(rd.get("discount", "")),
        )
        doc = build_document(deal, "hourly", {"slug": slug, "name": store_name})
        doc["store_name"] = store_name
        doc["websiteId"] = f"h_{slug}"
        db.offers.update_one(
            {"store_name": store_name, "sourceUrl": rd["sourceUrl"]},
            {"$set": {k: v for k, v in doc.items() if k != "createdAt"}},
            upsert=True,
        )
        submitted += 1
    return submitted

async def main():
    # Get all store slugs from sitemap
    try:
        async with httpx.AsyncClient(timeout=20.0) as c:
            r = await c.get("https://www.promocodes.com/sitemap-stores.xml",
                headers={"User-Agent": "Mozilla/5.0"})
        urls = re.findall(r'<loc>(.*?)</loc>', r.text)
        all_slugs = list(set(u.replace("https://www.promocodes.com/", "").replace("-coupons", "").rstrip("/") for u in urls))
    except Exception as e:
        print(f"Failed to fetch sitemap: {e}")
        return

    print(f"Available stores: {len(all_slugs)}")

    client = MongoClient(MONGO_URI)
    db = client.get_database()

    existing = set(db.offers.distinct("store_name"))
    existing_slugs = {s.lower().replace(" ", "-").replace("'", "") for s in existing}
    matched = [s for s in all_slugs if s in existing_slugs]
    new_ones = [s for s in all_slugs if s not in existing_slugs]

    to_scan = matched[:BATCH_SIZE]
    if len(to_scan) < BATCH_SIZE:
        to_scan += new_ones[:BATCH_SIZE - len(to_scan)]

    print(f"Scanning {len(to_scan)} brands")
    for slug in to_scan:
        name = slug.replace("-", " ").title()
        try:
            count = await scan_brand(slug, name, db)
            if count:
                print(f"  + {name}: {count} offers")
            await asyncio.sleep(0.5)
        except Exception as e:
            print(f"  ! {name}: {e}")

    total = db.offers.count_documents({"status": "published"})
    print(f"Total published: {total}")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
