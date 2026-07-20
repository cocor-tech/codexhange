"""
1. Test all websites for Cloudflare blocking
2. Remove blocked sites from DB
3. Generate writeups for working sites
"""

from pymongo import MongoClient
import asyncio, httpx, os
from datetime import datetime, timezone

uri = os.getenv("MONGODB_URI", "")
if not uri:
    uri = open("/root/codexhange/.env").read().split("MONGODB_URI=")[1].split("\n")[0]

client = MongoClient(uri)
db = client.get_database()

BLOCKED_KW = ["just a moment", "checking your browser", "cf-ray", "cloudflare",
              "performing security", "verifying you are human", "please enable cookies"]

def is_cloudflare(text: str) -> bool:
    return any(kw in text.lower()[:2000] for kw in BLOCKED_KW)

async def check_site(url: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as c:
            r = await c.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
            blocked = is_cloudflare(r.text) if r.status_code == 200 else False
            # 403 is likely Cloudflare too
            if r.status_code == 403:
                blocked = True
            return {"url": url, "status": r.status_code, "blocked": blocked, "len": len(r.text)}
    except Exception as e:
        return {"url": url, "status": 0, "blocked": False, "error": str(e)[:100]}

async def main():
    sites = list(db.websites.find({}))
    print(f"Testing {len(sites)} websites for Cloudflare...")

    blocked_sites = []
    clean_sites = []

    # Check in batches of 20
    for i in range(0, len(sites), 20):
        batch = sites[i:i+20]
        results = await asyncio.gather(*[check_site(s["url"]) for s in batch])
        for site, result in zip(batch, results):
            name = site.get("brand", {}).get("name", site.get("domain", "?"))
            if result.get("blocked") or result.get("status") == 403:
                blocked_sites.append(site)
                print(f"  BLOCKED {name:<30} {site['url']}")
            else:
                clean_sites.append(site)
                print(f"  OK      {name:<30} {site['url']} (status={result.get('status')})")

    # Remove blocked websites from DB
    if blocked_sites:
        blocked_ids = [s["_id"] for s in blocked_sites]
        result = db.websites.delete_many({"_id": {"$in": blocked_ids}})
        print(f"\nRemoved {result.deleted_count} Cloudflare-blocked websites")

    print(f"\nRemaining websites: {db.websites.count_documents({})}")

    # Generate writeups for clean sites that have offers
    offer_sites = list(db.websites.find({"stats.offers_found": {"$gt": 0}}))
    print(f"\nSites WITH discovered offers: {len(offer_sites)}")

    for site in offer_sites:
        name = site.get("brand", {}).get("name", "?")
        slug = site.get("brand", {}).get("slug", "?")
        offers = list(db.offers.find({"store_name": name, "status": "published"}).limit(5))
        if offers:
            print(f"\n--- {name} ---")
            for o in offers:
                print(f"  Code: {o.get('code', 'N/A')}")
                print(f"  Title: {o.get('title', 'N/A')}")
                print(f"  Discount: {o.get('discount', 'N/A')}")
                print(f"  Updated: {o.get('updatedAt', 'N/A')}")
                print(f"  Confidence: {o.get('confidence', 'N/A')}%")
                print()

if __name__ == "__main__":
    asyncio.run(main())
