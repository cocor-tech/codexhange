import asyncio, os, argparse, logging, re
from datetime import datetime, timezone, timedelta
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv
from colorama import Fore, Style, init
from bs4 import BeautifulSoup

load_dotenv()
init(autoreset=True)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

from db import connect, close
from client import create_shared_client
from app.config import settings
from app.models.deal import Deal
from app.adapters import HomepageAdapter, CrawlerAdapter, LinkDiscoveryAdapter
from app.publishers.mongo import build_document
from app.workers.enricher import load_provider, enrich_batch, NullProvider
from app.workers.scanner import scan_source

ADAPTERS = [HomepageAdapter(), CrawlerAdapter(), LinkDiscoveryAdapter()]
SEMAPHORE = asyncio.Semaphore(settings.CONCURRENCY)

BRAND_PATH_PATTERNS = [
    re.compile(r'/(?:store|stores|brand|brands|coupon|coupons|promo|promos|promo-code|deal|deals|offer|offers|discount|discounts|voucher|vouchers)/([a-z0-9][a-z0-9\-]{1,63})/?$', re.I),
    re.compile(r'/c/([a-z0-9][a-z0-9\-]{1,63})/?$', re.I),
]
SKIP_SLUGS = {'home', 'all', 'shop', 'login', 'signin', 'signup', 'register', 'cart',
              'checkout', 'contact', 'about', 'help', 'faq', 'privacy', 'terms',
              'sitemap', 'feed', 'feed.xml', 'robots.txt', 'search', 'category',
              'categories', 'stores', 'store', 'brands', 'brand', 'coupons', 'deals'}

def write_log(db, name, status, found=0, submitted=0, error=""):
    try:
        db.bot_logs.insert_one({"brand_name": name, "status": status,
            "offers_found": found, "offers_submitted": submitted,
            "error": error or None, "scanned_at": datetime.now(timezone.utc)})
    except: pass

def slugify(name: str) -> str:
    s = re.sub(r'[^a-z0-9\- ]', '', name.lower().strip())
    return re.sub(r'\s+', '-', s)[:80]

def normalize_brand_name(slug: str) -> str:
    name = slug.replace('-', ' ').replace('_', ' ')
    parts = [p for p in name.split() if p]
    return ' '.join(p.capitalize() for p in parts) if parts else slug

def find_slug_in_url(path: str):
    for pat in BRAND_PATH_PATTERNS:
        m = pat.search(path)
        if m:
            slug = m.group(1).lower()
            if slug not in SKIP_SLUGS:
                return slug
    return None

async def check_alive(url: str) -> bool:
    import httpx
    try:
        async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as c:
            async with c.stream("GET", url, headers={"User-Agent": "Mozilla/5.0"}) as r:
                return True
    except: return False

async def fetch_text(client, url, timeout=8.0):
    try:
        r = await client.get(url, timeout=timeout, follow_redirects=True)
        if r.status_code != 200:
            return None
        return r.text
    except Exception:
        return None

async def fetch_sitemap_urls(client, base: str) -> list:
    candidates = ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml",
                  "/sitemap1.xml", "/sitemap/sitemap.xml"]
    for path in candidates:
        text = await fetch_text(client, base.rstrip('/') + path)
        if not text:
            continue
        try:
            soup = BeautifulSoup(text, 'lxml')
            locs = [loc.get_text(strip=True) for loc in soup.find_all('loc')]
        except Exception:
            continue
        if not locs:
            continue
        if any('sitemap' in (u.lower()) and (u.lower().endswith('.xml')) for u in locs):
            nested = []
            for u in locs[:50]:
                sub = await fetch_text(client, u, timeout=6.0)
                if sub:
                    try:
                        sub_soup = BeautifulSoup(sub, 'lxml')
                        nested += [loc.get_text(strip=True) for loc in sub_soup.find_all('loc')]
                    except Exception:
                        continue
            locs = nested
        return [u for u in locs if u.startswith('http')]
    return []

def same_host(url: str, base: str) -> bool:
    try:
        return urlparse(url).netloc == urlparse(base).netloc
    except Exception:
        return False

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
            code=rd.get("code") or (rd.get("codes", [None])[0] if rd.get("codes") else None),
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

async def discover_from_sources(max_per_source=80):
    """Crawl the sources collection (coupon aggregators) and discover brands + codes."""
    db = connect()
    sources = list(db["sources"].find({"status": "active"}))
    print(f"{Fore.CYAN}=== Source discovery: {len(sources)} sources ==={Style.RESET_ALL}\n")
    now = datetime.now(timezone.utc)
    total_brands, total_offers = 0, 0

    async with create_shared_client() as client:
        for src in sources:
            sid = src["_id"]
            base = src.get("url", "").rstrip('/')
            sname = src.get("name", base)
            if not base:
                continue

            # 1) homepage links
            brand_pages = {}
            html = await fetch_text(client, base, timeout=8.0)
            if html:
                soup = BeautifulSoup(html, 'lxml')
                for a in soup.find_all('a', href=True):
                    try:
                        full = urljoin(base, a['href'])
                    except Exception:
                        continue
                    if not same_host(full, base):
                        continue
                    slug = find_slug_in_url(urlparse(full).path)
                    if not slug:
                        continue
                    if slug not in brand_pages:
                        brand_pages[slug] = full

            # 2) sitemap
            sitemap_urls = await fetch_sitemap_urls(client, base)
            for u in sitemap_urls:
                if not same_host(u, base):
                    continue
                slug = find_slug_in_url(urlparse(u).path)
                if slug and slug not in brand_pages:
                    brand_pages[slug] = u

            if not brand_pages:
                db["sources"].update_one({"_id": sid}, {"$set": {
                    "stats.last_scan": now, "stats.last_error": "no brand pages found"}})
                print(f"  {Fore.YELLOW}[-] {sname:<24} 0 brand pages{Style.RESET_ALL}")
                continue

            slugs = list(brand_pages.keys())[:max_per_source]
            discovered = 0
            offers = 0

            for slug in slugs:
                page_url = brand_pages[slug]
                bname = normalize_brand_name(slug)

                # upsert brand
                existing = db["brands"].find_one({"slug": slug})
                if existing:
                    brand_id = existing["_id"]
                else:
                    brand_doc = {
                        "name": bname, "slug": slug, "website": page_url,
                        "categories": [], "hasPromoCodes": True,
                        "hasReferralProgram": False, "country": "US",
                        "active": True, "source": sname, "sourceUrl": page_url,
                        "createdAt": now, "updatedAt": now,
                    }
                    brand_id = db["brands"].insert_one(brand_doc).inserted_id
                db["brands"].update_one({"_id": brand_id},
                    {"$set": {"website": page_url, "source": sname, "sourceUrl": page_url, "updatedAt": now}})

                # upsert website pointing at the source's brand page
                ws = db["websites"].find_one({"url": page_url})
                if not ws:
                    ws_id = db["websites"].insert_one({
                        "url": page_url,
                        "domain": urlparse(page_url).netloc,
                        "brand": {"name": bname, "slug": slug},
                        "status": "active",
                        "kind": "brand",
                        "source": sname,
                        "settings": {"scan_frequency": 6, "crawl_depth": 1,
                                     "javascript": False, "auto_publish": True, "ai_enabled": True},
                        "stats": {"offers_found": 0, "offers_published": 0, "blocked_count": 0,
                                  "success_rate": 0, "health_score": 0},
                        "createdAt": now, "updatedAt": now,
                    }).inserted_id
                else:
                    ws_id = ws["_id"]
                    db["websites"].update_one({"_id": ws_id},
                        {"$set": {"kind": "brand", "source": sname, "updatedAt": now}})

                # scan the source brand page for codes
                result = await scan_source(client, page_url, bname)
                if result.get("blocked"):
                    db["websites"].update_one({"_id": ws_id}, {"$inc": {"stats.blocked_count": 1}})
                    continue
                if result.get("success") and result.get("codes"):
                    code = result["codes"][0] if result["codes"] else None
                    deal = Deal(
                        store_name=bname,
                        deal_type=result.get("deal_type", "sale"),
                        code=code,
                        title=str(result.get("title") or f"{bname} offer")[:200],
                        destination_url=page_url,
                        source_page=page_url,
                        confidence_score=85 if code else 60,
                        strategy="source_discovery",
                        countries=result.get("countries", []),
                        discount_value=result.get("discount", ""),
                    )
                    doc = build_document(deal, ws_id, {"brand": {"name": bname, "slug": slug}, "url": page_url})
                    doc["store_name"] = bname
                    doc["websiteId"] = ws_id
                    db.offers.delete_many({"websiteId": ws_id, "sourceUrl": page_url, "status": {"$ne": "published"}})
                    db.offers.insert_one(doc)
                    offers += 1
                    discovered += 1

                db["websites"].update_one({"_id": ws_id},
                    {"$set": {"stats.last_scan": now, "stats.offers_found": offers}})

            db["sources"].update_one({"_id": sid}, {"$set": {
                "stats.brands_found": discovered,
                "stats.offers_found": offers,
                "stats.last_scan": now,
                "stats.last_error": None}})
            total_brands += discovered
            total_offers += offers
            print(f"  {Fore.GREEN}[+] {sname:<24} brands={discovered} offers={offers}{Style.RESET_ALL}")

    print(f"\n{Fore.CYAN}=== Done: {total_brands} brands, {total_offers} offers ==={Style.RESET_ALL}")
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

        site = db["websites"].find_one({"_id": job["websiteId"]})
        if not site:
            scanjobs.update_one({"_id": job["_id"]}, {"$set": {"status": "failed", "error": "Website not found", "finished_at": datetime.now(timezone.utc)}})
            continue

        brand_name = site.get("brand", {}).get("name", site.get("domain", "Unknown"))
        url = job["url"]

        alive = await check_alive(url.rstrip("/"))
        if not alive:
            scanjobs.update_one({"_id": job["_id"]}, {"$set": {"status": "blocked", "error": "site unreachable", "finished_at": datetime.now(timezone.utc)}})
            db["websites"].update_one({"_id": site["_id"]}, {"$inc": {"stats.blocked_count": 1}})
            print(f"  {Fore.RED}[-] {brand_name:<20} site unreachable{Style.RESET_ALL}")
            continue

        async with create_shared_client() as client:
            try:
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
    VERSION = "2.1.0"
    p = argparse.ArgumentParser(description="Codexhange Offer Intelligence Platform")
    p.add_argument("--scan", action="store_true", help="Scan all active websites")
    p.add_argument("--sources", action="store_true", help="Discover brands + offers from crawl sources")
    p.add_argument("--max-per-source", type=int, default=80, help="Max brand pages per source")
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
    if args.sources:
        asyncio.run(discover_from_sources(max_per_source=args.max_per_source)); return
    if args.stale: asyncio.run(discover_all(stale_hours=24)); return
    if args.scan:
        names = [n.strip() for n in args.names.split(",")] if args.names else None
        asyncio.run(discover_all(max_brands=args.max, names=names)); return
    p.print_help()

if __name__ == "__main__":
    main()