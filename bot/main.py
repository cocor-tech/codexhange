import asyncio, os, argparse, logging
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from colorama import Fore, Style, init

load_dotenv()
init(autoreset=True)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

from db import connect, close
from client import create_shared_client
from app.config import settings
from app.models.deal import Deal
from app.adapters.promocodes import PromoCodesAdapter
from app.adapters.couponbind import CouponBindAdapter
from app.publishers.mongo import build_document, insert_blocked
from app.workers.enricher import load_provider, enrich_batch

ADAPTERS = [PromoCodesAdapter(), CouponBindAdapter()]
SEMAPHORE = asyncio.Semaphore(settings.CONCURRENCY)

def write_log(db, name, status, found=0, submitted=0, error=""):
    try:
        db.bot_logs.insert_one({"brand_name": name, "status": status,
            "offers_found": found, "offers_submitted": submitted,
            "error": error or None, "scanned_at": datetime.now(timezone.utc)})
    except: pass

async def check_alive(url: str) -> bool:
    import httpx
    try:
        async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as c:
            async with c.stream("GET", url, headers={"User-Agent": "Mozilla/5.0"}) as r:
                return True  # Any response means the server is alive
    except: return False

async def process_website(db, site, client):
    wid = site["_id"]
    brand_name = site.get("brand", {}).get("name", site.get("domain", "Unknown"))
    url = site["url"]

    alive = await check_alive(url.rstrip("/"))
    if not alive:
        print(f"  {Fore.RED}[-] {brand_name:<20} site unreachable{Style.RESET_ALL}")
        write_log(db, brand_name, "unreachable")
        return

    brand_data = {"brandId": str(wid), "brandName": brand_name, "website": url}
    try:
        results = await asyncio.wait_for(
            asyncio.gather(*[a.discover(brand_data, client) for a in ADAPTERS], return_exceptions=True), timeout=30.0)
    except asyncio.TimeoutError:
        print(f"  {Fore.RED}[-] {brand_name:<20} timeout{Style.RESET_ALL}")
        write_log(db, brand_name, "timeout"); return

    raw = []
    for i, r in enumerate(results):
        if isinstance(r, list):
            for d in r:
                d["_adapter"] = ADAPTERS[i].name
            raw.extend(r)
    if not raw:
        print(f"  {Fore.YELLOW}[-] {brand_name:<20} found=0{Style.RESET_ALL}")
        write_log(db, brand_name, "found_none"); return

    blocked = [d for d in raw if d.get("blocked")]
    normal = [d for d in raw if not d.get("blocked")]
    best = {}
    for d in normal:
        k = d["sourceUrl"].rstrip("/").lower()
        if k not in best or d.get("confidence", 0) > best[k].get("confidence", 0):
            best[k] = d

    now = datetime.now(timezone.utc)
    submitted = 0
    db.offers.delete_many({"websiteId": wid, "status": {"$nin": ["published", "blocked"]}})

    for d in blocked:
        db.offers.update_one({"websiteId": wid, "sourceUrl": d["sourceUrl"]},
            {"$set": {"status": "blocked", "blocked_reason": d.get("blocked_reason", "unknown"),
                      "sourceUrl": d["sourceUrl"], "updatedAt": now, "store_name": brand_name}},
            upsert=True)

    for rd in best.values():
        deal = Deal(store_name=brand_name, deal_type="sale",
            code=rd.get("codes", [None])[0] if rd.get("codes") else None,
            title=str(rd.get("title") or f"{brand_name} offer"),
            description=str(rd.get("description") or ""),
            destination_url=str(rd["sourceUrl"]),
            source_page=str(rd.get("sourcePage", "")),
            confidence_score=min(int(rd.get("confidence", 50)), 99),
            strategy=str(rd.get("_adapter", "")),
            countries=rd.get("countries", []) or [],
            discount_value=str(rd.get("discount", "")))
        doc = build_document(deal, wid, site)
        doc["store_name"] = brand_name
        doc["websiteId"] = wid
        db.offers.insert_one(doc)
        submitted += 1

    if submitted > 0:
        try:
            provider = load_provider(db)
            if not isinstance(provider, NullProvider):
                to_enrich = list(db.offers.find({"websiteId": wid, "status": {"$ne": "published"}}).limit(50))
                if to_enrich:
                    enriched = await enrich_batch(to_enrich, provider)
                    for e in enriched:
                        db.offers.update_one({"_id": e["_id"]}, {"$set": {
                            "title": e.get("title"), "deal_type": e.get("deal_type"),
                            "tags": e.get("tags", []), "enriched": True,
                        }})
        except:
            pass

    db["websites"].update_one({"_id": wid}, {"$set": {"stats.last_scan": now, "stats.offers_found": submitted}})
    write_log(db, brand_name, "success", found=len(raw), submitted=submitted)
    bc = f"{Fore.RED}[BLOCKED {len(blocked)}] " if blocked else ""
    print(f"  {Fore.GREEN}[+] {brand_name:<20} found={len(normal)} submitted={submitted} {bc}{Style.RESET_ALL}")

async def discover_all(max_brands=None, stale_hours=None, names=None):
    db = connect()
    query = {"status": "active"}
    if stale_hours:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=stale_hours)
        query["$or"] = [{"stats.last_scan": {"$lt": cutoff}}, {"stats.last_scan": None}]
    if names:
        query["brand.name"] = {"$in": names}
    sites = list(db["websites"].find(query).sort([("stats.last_scan", 1), ("brand.name", 1)]).limit(max_brands or 500))
    print(f"{Fore.CYAN}=== Scanning {len(sites)} websites ==={Style.RESET_ALL}\n")
    async with create_shared_client() as client:
        async def worker(site):
            async with SEMAPHORE:
                try:
                    await asyncio.wait_for(process_website(db, site, client), timeout=120.0)
                except asyncio.TimeoutError:
                    write_log(db, site.get("brand",{}).get("name",site.get("domain","?")), "timeout")
                    print(f"  {Fore.RED}[-] {site.get('brand',{}).get('name','?'):<20} timeout{Style.RESET_ALL}")
                except Exception as e:
                    print(f"  {Fore.RED}[-] {site.get('brand',{}).get('name','?'):<20} error: {e}{Style.RESET_ALL}")
        await asyncio.gather(*[worker(s) for s in sites])
    print(f"\n{Fore.CYAN}Done.{Style.RESET_ALL}")
    close()

def purge_expired():
    db = connect()
    now = datetime.now(timezone.utc)
    r = db.offers.update_many({"expiresAt": {"$lt": now}, "status": {"$ne": "expired"}}, {"$set": {"status": "expired", "updatedAt": now}})
    print(f"Purged {r.modified_count} expired offers")
    close()

async def process_jobs():
    """Pick up queued scan jobs and process them one at a time"""
    db = connect()
    while True:
        scanjobs = db["scanjobs"]
        job = scanjobs.find_one_and_update(
            {"status": "queued"},
            {"$set": {"status": "running", "started_at": datetime.now(timezone.utc)}},
            sort=[("priority", -1), ("createdAt", 1)])
        if not job:
            print(f"{Fore.YELLOW}No queued jobs.{Style.RESET_ALL}")
            close()
            return

        print(f"{Fore.CYAN}Processing job: {job['url']}{Style.RESET_ALL}")

        # Get the website for this job
        site = db["websites"].find_one({"_id": job["websiteId"]})
        if not site:
            scanjobs.update_one({"_id": job["_id"]}, {"$set": {"status": "failed", "error": "Website not found", "finished_at": datetime.now(timezone.utc)}})
            continue

        brand_name = site.get("brand", {}).get("name", site.get("domain", "Unknown"))
        url = job["url"]

        # Check alive
        alive = await check_alive(url.rstrip("/"))
        if not alive:
            scanjobs.update_one({"_id": job["_id"]}, {"$set": {"status": "blocked", "error": "site unreachable", "finished_at": datetime.now(timezone.utc)}})
            db["websites"].update_one({"_id": site["_id"]}, {"$inc": {"stats.blocked_count": 1}})
            print(f"  {Fore.RED}[-] {brand_name:<20} site unreachable{Style.RESET_ALL}")
            continue

        # Process the single URL
        async with create_shared_client() as client:
            try:
                from app.workers.scanner import scan_source
                result = await asyncio.wait_for(scan_source(client, url, brand_name), timeout=30.0)

                if result.get("blocked"):
                    scanjobs.update_one({"_id": job["_id"]}, {"$set": {"status": "blocked", "error": "cloudflare", "finished_at": datetime.now(timezone.utc)}})
                    db["websites"].update_one({"_id": site["_id"]}, {"$inc": {"stats.blocked_count": 1}})
                    print(f"  {Fore.RED}[-] {brand_name:<20} blocked{Style.RESET_ALL}")
                    continue

                if result.get("success") and result.get("codes"):
                    deal = Deal(
                        store_name=brand_name,
                        deal_type=result["deal_type"],
                        code=result["codes"][0] if result["codes"] else None,
                        title=result.get("title", "")[:200],
                        destination_url=url,
                        confidence_score=85 if result["codes"] else 60,
                        strategy="scan_job",
                        countries=result.get("countries", []),
                        discount_value=result.get("discount", ""),
                    )
                    doc = build_document(deal, site["_id"], site)
                    doc["store_name"] = brand_name
                    doc["websiteId"] = site["_id"]
                    # Wipe old non-published offers for this URL
                    db.offers.delete_many({"websiteId": site["_id"], "sourceUrl": url, "status": {"$ne": "published"}})
                    db.offers.insert_one(doc)
                    scanjobs.update_one({"_id": job["_id"]}, {"$set": {"status": "completed", "offers_found": len(result["codes"]), "finished_at": datetime.now(timezone.utc)}})
                    db["websites"].update_one({"_id": site["_id"]}, {"$inc": {"stats.offers_found": 1}, "$set": {"stats.last_scan": datetime.now(timezone.utc)}})
                    print(f"  {Fore.GREEN}[+] {brand_name:<20} found {len(result['codes'])} codes{Style.RESET_ALL}")
                else:
                    scanjobs.update_one({"_id": job["_id"]}, {"$set": {"status": "completed", "offers_found": 0, "finished_at": datetime.now(timezone.utc)}})
                    print(f"  {Fore.YELLOW}[-] {brand_name:<20} found 0 codes{Style.RESET_ALL}")

            except asyncio.TimeoutError:
                scanjobs.update_one({"_id": job["_id"]}, {"$set": {"status": "failed", "error": "timeout", "finished_at": datetime.now(timezone.utc)}})
                print(f"  {Fore.RED}[-] {brand_name:<20} timeout{Style.RESET_ALL}")

def main():
    VERSION = "2.0.0"
    p = argparse.ArgumentParser(description="Codexhange Offer Intelligence Platform")
    p.add_argument("--scan", action="store_true", help="Scan all active websites")
    p.add_argument("--process-jobs", action="store_true", help="Process queued scan jobs")
    p.add_argument("--max", type=int, help="Max websites to scan")
    p.add_argument("--names", type=str, help="Filter by brand names (comma-separated)")
    p.add_argument("--stale", action="store_true", help="Scan websites not checked in 24h")
    p.add_argument("--purge-expired", action="store_true", help="Mark expired offers")
    p.add_argument("--version", action="store_true", help="Show version")
    args = p.parse_args()
    if args.version: print(f"Codexhange Bot v{VERSION}"); return
    if args.purge_expired: purge_expired(); return
    if args.process_jobs: asyncio.run(process_jobs()); return
    if args.stale: asyncio.run(discover_all(stale_hours=24)); return
    if args.scan:
        names = [n.strip() for n in args.names.split(",")] if args.names else None
        asyncio.run(discover_all(max_brands=args.max, names=names)); return
    p.print_help()

if __name__ == "__main__":
    main()
