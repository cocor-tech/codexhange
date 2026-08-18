import asyncio, os, argparse, logging, re, time
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
from app.publishers.mongo import build_document, upsert_offer
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

def homepage_url(db, website_id) -> str | None:
    """Return the canonical homepage URL for a website (kind=homepage), else any url."""
    u = db["urls"].find_one({"websiteId": website_id, "kind": "homepage"})
    if u:
        return u["url"]
    u = db["urls"].find_one({"websiteId": website_id})
    return u["url"] if u else None

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
    brand_name = site.get("name", site.get("domain", "Unknown"))
    url = await homepage_url(db, wid) or f"https://{site.get('domain', '')}"

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
        upsert_offer(db, doc, wid, doc["sourceUrl"])
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
    """Scan active websites, grouped by scan level: level 1 (fast) every run,
    level 2 after 24h, level 3 (slow) after 72h."""
    db = connect()
    query = {"status": "active"}
    if stale_hours:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=stale_hours)
        query["$or"] = [{"stats.last_scan": {"$lt": cutoff}}, {"stats.last_scan": None}]
    else:
        now = datetime.now(timezone.utc)
        ors = []
        for lvl, hours in LEVEL_INTERVALS.items():
            cut = now - timedelta(hours=hours)
            ors.append({"scanLevel": lvl, "stats.last_scan": {"$lt": cut}})
            ors.append({"scanLevel": lvl, "stats.last_scan": None})
        ors.append({"scanLevel": {"$exists": False}, "stats.last_scan": {"$lt": now - timedelta(hours=12)}})
        ors.append({"scanLevel": {"$exists": False}, "stats.last_scan": None})
        query["$or"] = ors
    if names:
        query["name"] = {"$in": names}
    sites = list(db["websites"].find(query).sort([("scanLevel", 1), ("stats.last_scan", 1)]).limit(max_brands or 500))
    levels = {}
    for s in sites:
        levels[s.get("scanLevel") or 0] = levels.get(s.get("scanLevel") or 0, 0) + 1
    print(f"{Fore.CYAN}=== Scanning {len(sites)} websites (L1={levels.get(1,0)} L2={levels.get(2,0)} L3={levels.get(3,0)}) ==={Style.RESET_ALL}\n")
    async with create_shared_client() as client:
        async def worker(site):
            async with SEMAPHORE:
                try:
                    await asyncio.wait_for(process_website(db, site, client), timeout=120.0)
                except asyncio.TimeoutError:
                    write_log(db, site.get("name", site.get("domain", "?")), "timeout")
                    print(f"  {Fore.RED}[-] {site.get('name','?'):<20} timeout{Style.RESET_ALL}")
                except Exception as e:
                    print(f"  {Fore.RED}[-] {site.get('name','?'):<20} error: {e}{Style.RESET_ALL}")
        await asyncio.gather(*[worker(s) for s in sites])
    print(f"\n{Fore.CYAN}Done.{Style.RESET_ALL}")
    close()

LEVEL_INTERVALS = {1: 6, 2: 24, 3: 72}      # hours until next scan per level
LEVEL_MAX_PER_SOURCE = {1: 80, 2: 40, 3: 15}  # brand pages crawled per level
LEVEL_MAX_TIME = {1: 8.0, 2: 12.0, 3: 15.0}   # homepage fetch timeout per level

def classify_level(avg_scan_time: float) -> int:
    """Level 1 = fast (<8s), 2 = medium (<20s), 3 = slow (>=20s)."""
    if avg_scan_time < 8:
        return 1
    if avg_scan_time < 20:
        return 2
    return 3

def upsert_website(db, slug: str, name: str, domain: str, level: int, now) -> str:
    """Find by slug first, then by domain; insert last (DuplicateKey-safe)."""
    ws = db["websites"].find_one({"slug": slug})
    if not ws and domain:
        ws = db["websites"].find_one({"domain": domain})
    if ws:
        db["websites"].update_one({"_id": ws["_id"]},
            {"$set": {"name": name, "domain": domain or ws.get("domain", ""),
                      "scanLevel": level, "updatedAt": now}})
        return ws["_id"]
    try:
        return db["websites"].insert_one({
            "name": name, "slug": slug, "domain": domain,
            "scanLevel": level, "status": "active",
            "settings": {"scan_frequency": 6, "crawl_depth": 1,
                         "javascript": False, "auto_publish": True, "ai_enabled": False},
            "stats": {"offers_found": 0, "offers_published": 0, "blocked_count": 0,
                      "success_rate": 0, "health_score": 100},
            "createdAt": now, "updatedAt": now,
        }).inserted_id
    except Exception:
        ws = db["websites"].find_one({"slug": slug}) or db["websites"].find_one({"domain": domain})
        if ws:
            return ws["_id"]
        raise

async def discover_from_sources(max_per_source=80, force=False):
    """Crawl the sources collection (coupon aggregators) and discover brands + codes.

    New model:
      - websites  = company entity (one per brand slug, canonical domain)
      - urls      = pages belonging to a website (homepage, source page, coupon page)
      - offers    = reference websiteId + urlId, destination_url = resolved merchant URL
    Redirect links ("Shop Now" buttons) are resolved to the real merchant URL.

    Scan levels: sources are grouped by speed (1 fast / 2 medium / 3 slow) based on
    measured scan time; each level is scanned on its own schedule (6h / 24h / 72h).
    """
    from app.services.resolver import resolve_final_url, looks_like_redirect, is_redirect_domain
    from urllib.parse import urlparse as _up

    db = connect()
    now = datetime.now(timezone.utc)
    sources = list(db["sources"].find({"status": "active"}))
    due = [s for s in sources if force or not s.get("nextScanAt") or s["nextScanAt"] <= now]
    skipped = len(sources) - len(due)
    if skipped:
        print(f"{Fore.YELLOW}=== Skipping {skipped} sources not due yet (scan levels) ==={Style.RESET_ALL}")
    print(f"{Fore.CYAN}=== Source discovery: {len(due)} due sources ==={Style.RESET_ALL}\n")
    total_brands, total_offers = 0, 0

    def canonical_domain(url: str) -> str:
        try:
            return _up(url).netloc.lower().replace("www.", "")
        except Exception:
            return ""

    async with create_shared_client() as client:
        for src in due:
            sid = src["_id"]
            base = src.get("url", "").rstrip('/')
            sname = src.get("name", base)
            if not base:
                continue
            level = int(src.get("scanLevel") or 2)
            cap = min(max_per_source, LEVEL_MAX_PER_SOURCE.get(level, 40))
            started = time.monotonic()

            # 1) homepage links
            brand_pages = {}
            html = await fetch_text(client, base, timeout=LEVEL_MAX_TIME.get(level, 12.0))
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

            slugs = list(brand_pages.keys())[:cap]
            discovered = 0
            offers = 0

            for slug in slugs:
                page_url = brand_pages[slug]
                bname = normalize_brand_name(slug)
                source_domain = canonical_domain(base)

                # -- resolve the brand page itself if it's a redirect --
                merchant_url = page_url
                if looks_like_redirect(page_url):
                    res = await resolve_final_url(client, page_url)
                    if res.get("ok") and not is_redirect_domain(res.get("domain", "")):
                        merchant_url = res["final_url"]

                # -- upsert Website (company entity) --
                ws_id = upsert_website(db, slug, bname, canonical_domain(merchant_url), level, now)
                discovered += 1

                # -- upsert Url (source brand page) grouped under the website --
                url_doc = db["urls"].find_one({"url": page_url})
                if not url_doc:
                    url_id = db["urls"].insert_one({
                        "websiteId": ws_id, "url": page_url,
                        "domain": canonical_domain(page_url),
                        "kind": "source_page", "source": sname, "status": "active",
                        "stats": {"offers_found": 0, "blocked_count": 0, "health_score": 100},
                        "createdAt": now, "updatedAt": now,
                    }).inserted_id
                else:
                    url_id = url_doc["_id"]
                    db["urls"].update_one({"_id": url_id},
                        {"$set": {"websiteId": ws_id, "source": sname, "updatedAt": now}})

                # -- also store the resolved merchant homepage URL (if it's a real site) --
                resolved_id = None
                if merchant_url != page_url and canonical_domain(merchant_url) != source_domain:
                    mdoc = db["urls"].find_one({"url": merchant_url})
                    if not mdoc:
                        resolved_id = db["urls"].insert_one({
                            "websiteId": ws_id, "url": merchant_url,
                            "domain": canonical_domain(merchant_url),
                            "kind": "homepage", "source": sname, "status": "active",
                            "stats": {"offers_found": 0, "blocked_count": 0, "health_score": 100},
                            "createdAt": now, "updatedAt": now,
                        }).inserted_id
                    else:
                        resolved_id = mdoc["_id"]

                # -- scan the source brand page for codes --
                result = await scan_source(client, page_url, bname, db=db)
                if result.get("blocked"):
                    db["urls"].update_one({"_id": url_id}, {"$inc": {"stats.blocked_count": 1}})
                    continue
                if result.get("success") and result.get("codes"):
                    code = result["codes"][0] if result["codes"] else None
                    # Prefer the resolved merchant URL from a "Shop Now"/"Get Code"
                    # button over the aggregator brand page itself.
                    dest = merchant_url
                    outbound = result.get("outbound_links") or []
                    if outbound:
                        dest = outbound[0]["final_url"]
                    deal = Deal(
                        store_name=bname,
                        deal_type=result.get("deal_type", "sale"),
                        code=code,
                        title=str(result.get("title") or f"{bname} offer")[:200],
                        destination_url=dest,
                        source_page=page_url,
                        confidence_score=85 if code else 60,
                        strategy="source_discovery",
                        countries=result.get("countries", []),
                        discount_value=result.get("discount", ""),
                    )
                    doc = build_document(deal, ws_id, {"name": bname, "slug": slug})
                    doc["store_name"] = bname
                    doc["websiteId"] = ws_id
                    doc["urlId"] = url_id
                    if resolved_id:
                        doc["resolvedUrlId"] = resolved_id
                    upsert_offer(db, doc, ws_id, doc["sourceUrl"])
                    # Drop stale offers for this page when the merchant URL changed
                    db.offers.delete_many({"websiteId": ws_id, "sourcePage": page_url,
                                           "sourceUrl": {"$ne": doc["sourceUrl"]}})
                    offers += 1

                # -- crawl AI-detected promo/coupon links found on the brand page --
                for promo_url in result.get("promo_links", [])[:3]:
                    try:
                        full = urljoin(page_url, promo_url)
                    except Exception:
                        continue
                    if not same_host(full, page_url):
                        continue
                    pdoc = db["urls"].find_one({"url": full})
                    if not pdoc:
                        p_url_id = db["urls"].insert_one({
                            "websiteId": ws_id, "url": full,
                            "domain": canonical_domain(full),
                            "kind": "coupon_page", "source": sname, "status": "active",
                            "stats": {"offers_found": 0, "blocked_count": 0, "health_score": 100},
                            "createdAt": now, "updatedAt": now,
                        }).inserted_id
                    else:
                        p_url_id = pdoc["_id"]
                        db["urls"].update_one({"_id": p_url_id},
                            {"$set": {"websiteId": ws_id, "source": sname, "updatedAt": now}})

                    pres = await scan_source(client, full, bname, db=db)
                    if pres.get("blocked") or not pres.get("success"):
                        continue
                    if pres.get("codes"):
                        pcode = pres["codes"][0]
                        pdeal = Deal(
                            store_name=bname,
                            deal_type=pres.get("deal_type", "code" if pcode else "sale"),
                            code=pcode,
                            title=str(pres.get("title") or f"{bname} offer")[:200],
                            destination_url=full,
                            source_page=full,
                            confidence_score=85 if pcode else 60,
                            strategy="source_discovery",
                            countries=pres.get("countries", []),
                            discount_value=pres.get("discount", ""),
                        )
                        pdoc_b = build_document(pdeal, ws_id, {"name": bname, "slug": slug})
                        pdoc_b["store_name"] = bname
                        pdoc_b["websiteId"] = ws_id
                        pdoc_b["urlId"] = p_url_id
                        upsert_offer(db, pdoc_b, ws_id, pdoc_b["sourceUrl"])
                        db.offers.delete_many({"websiteId": ws_id, "sourcePage": full,
                                               "sourceUrl": {"$ne": pdoc_b["sourceUrl"]}})
                        offers += 1
                    db["urls"].update_one({"_id": p_url_id},
                        {"$set": {"stats.last_scan": now, "stats.offers_found": 1 if pres.get("codes") else 0}})

                db["urls"].update_one({"_id": url_id},
                    {"$set": {"stats.last_scan": now, "stats.offers_found": offers}})
                db["websites"].update_one({"_id": ws_id},
                    {"$set": {"stats.last_scan": now, "stats.offers_found": offers}})

            elapsed = time.monotonic() - started
            prev_avg = src.get("avgScanTime") or elapsed
            avg = round(0.7 * prev_avg + 0.3 * elapsed, 2)
            level = classify_level(avg)
            next_scan = now + timedelta(hours=LEVEL_INTERVALS[level])
            db["sources"].update_one({"_id": sid}, {"$set": {
                "scanLevel": level,
                "avgScanTime": avg,
                "nextScanAt": next_scan,
                "stats.brands_found": discovered,
                "stats.offers_found": offers,
                "stats.last_scan": now,
                "stats.last_error": None}})
            total_brands += discovered
            total_offers += offers
            print(f"  {Fore.GREEN}[+] {sname:<24} L{level} {avg:.1f}s brands={discovered} offers={offers} next={next_scan.strftime('%m-%d %H:%M')}{Style.RESET_ALL}")

    print(f"\n{Fore.CYAN}=== Done: {total_brands} brands, {total_offers} offers ==={Style.RESET_ALL}")

    # -- re-verify previously published offers (auto-expire dead codes) --
    try:
        from app.workers.verifier import reverify_all
        print(f"\n{Fore.CYAN}=== Re-verifying offers from {len(due)} crawled sources ==={Style.RESET_ALL}")
        vstats = await reverify_all(db, client, sources=due)
        print(f"  Checked {vstats['checked']} offers, expired {vstats['expired']} dead codes")
    except Exception as e:
        print(f"  {Fore.YELLOW}[!] Re-verify skipped: {e}{Style.RESET_ALL}")

    # -- AI enrichment + cross-source comparison (only when AI is configured) --
    try:
        provider = load_provider(db)
        if not isinstance(provider, NullProvider):
            from app.workers.comparer import compare_all_brands
            print(f"\n{Fore.CYAN}=== AI cross-source comparison ==={Style.RESET_ALL}")
            to_enrich = list(db.offers.find({"strategy": "source_discovery",
                                             "enriched": {"$ne": True}}).limit(150))
            if to_enrich:
                enriched = await enrich_batch(to_enrich, provider)
                for e in enriched:
                    db.offers.update_one({"_id": e["_id"]}, {"$set": {
                        "title": e.get("title"), "deal_type": e.get("deal_type"),
                        "tags": e.get("tags", []), "enriched": True,
                    }})
                print(f"  Enriched {len(enriched)} offers")
            stats = await compare_all_brands(db, provider)
            print(f"  Compared {stats['brands']} brands / {stats['offers']} offers, "
                  f"archived {stats['archived']} duplicates")
    except Exception as e:
        print(f"  {Fore.YELLOW}[!] AI compare skipped: {e}{Style.RESET_ALL}")

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

        brand_name = site.get("name", site.get("domain", "Unknown"))
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
                    upsert_offer(db, doc, site["_id"], doc["sourceUrl"])
                    scanjobs.update_one({"_id": job["_id"]}, {"$set": {"status": "completed", "offers_found": len(result["codes"]), "finished_at": datetime.now(timezone.utc)}})
                    db["websites"].update_one({"_id": site["_id"]}, {"$inc": {"stats.offers_found": 1}, "$set": {"stats.last_scan": datetime.now(timezone.utc)}})
                    print(f"  {Fore.GREEN}[+] {brand_name:<20} found {len(result['codes'])} codes{Style.RESET_ALL}")
                else:
                    scanjobs.update_one({"_id": job["_id"]}, {"$set": {"status": "completed", "offers_found": 0, "finished_at": datetime.now(timezone.utc)}})
                    print(f"  {Fore.YELLOW}[-] {brand_name:<20} found 0 codes{Style.RESET_ALL}")

            except asyncio.TimeoutError:
                scanjobs.update_one({"_id": job["_id"]}, {"$set": {"status": "failed", "error": "timeout", "finished_at": datetime.now(timezone.utc)}})
                print(f"  {Fore.RED}[-] {brand_name:<20} timeout{Style.RESET_ALL}")

def reset_new_model():
    """Full reset: wipe ALL data (sources, users, offers, websites, urls) and drop
    stale indexes left over from older models. Admin re-seeds on login."""
    db = connect()
    for coll in ("websites", "urls", "offers", "brands"):
        try:
            db[coll].drop_indexes()
        except Exception:
            pass
    urls = db["urls"].delete_many({})
    websites = db["websites"].delete_many({})
    offers = db["offers"].delete_many({})
    brands = db["brands"].delete_many({})
    scanjobs = db["scanjobs"].delete_many({})
    sources = db["sources"].delete_many({})
    users = db["users"].delete_many({})
    logs = db["bot_logs"].delete_many({})
    print(f"Full reset: urls={urls.deleted_count} websites={websites.deleted_count} "
          f"offers={offers.deleted_count} brands={brands.deleted_count} "
          f"sources={sources.deleted_count} users={users.deleted_count} "
          f"scanjobs={scanjobs.deleted_count} logs={logs.deleted_count}")
    close()

def main():
    VERSION = "2.5.0"
    p = argparse.ArgumentParser(description="Codexhange Offer Intelligence Platform")
    p.add_argument("--scan", action="store_true", help="Scan all active websites")
    p.add_argument("--sources", action="store_true", help="Discover brands + offers from crawl sources")
    p.add_argument("--max-per-source", type=int, default=80, help="Max brand pages per source")
    p.add_argument("--force", action="store_true", help="Ignore scan-level schedules (scan everything now)")
    p.add_argument("--process-jobs", action="store_true", help="Process queued scan jobs")
    p.add_argument("--max", type=int, help="Max websites to scan")
    p.add_argument("--names", type=str, help="Filter by brand names (comma-separated)")
    p.add_argument("--stale", action="store_true", help="Scan websites not checked in 24h")
    p.add_argument("--compare", action="store_true", help="AI cross-source compare: score + dedupe offers per brand")
    p.add_argument("--reverify", action="store_true", help="Re-check published offers against their sources; soft-expire dead codes (health /5)")
    p.add_argument("--seed-sources", type=str, metavar="FILE", help="Seed sources collection from a JSON file [{name,url,type,frequency_hours,status}]")
    p.add_argument("--purge-expired", action="store_true", help="Mark expired offers")
    p.add_argument("--reset", action="store_true", help="Full reset: wipe all data (sources, users, offers, websites, urls)")
    p.add_argument("--version", action="store_true", help="Show version")
    args = p.parse_args()
    if args.version: print(f"Codexhange Bot v{VERSION}"); return
    if args.reset: reset_new_model(); return
    if args.purge_expired: purge_expired(); return
    if args.process_jobs: asyncio.run(process_jobs()); return
    if args.seed_sources:
        import json as _json
        db = connect()
        with open(args.seed_sources) as f:
            data = _json.load(f)
        items = data.get("batch", data) if isinstance(data, dict) else data
        created = skipped = 0
        for s in items:
            u = (s.get("url") or "").strip()
            if not u:
                continue
            if db["sources"].find_one({"url": u}):
                skipped += 1
                continue
            db["sources"].insert_one({
                "name": (s.get("name") or u.replace("https://", "").replace("http://", "").replace("www.", "")).strip(),
                "url": u,
                "type": s.get("type") or "promo",
                "frequency_hours": s.get("frequency_hours") or 6,
                "status": s.get("status") or "active",
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
            })
            created += 1
        print(f"Seeded {created} sources ({skipped} already present)")
        close(); return
    if args.compare:
        from app.workers.comparer import compare_all_brands
        db = connect()
        provider = load_provider(db)
        if isinstance(provider, NullProvider):
            print(f"{Fore.YELLOW}No AI provider configured (ai_config in DB or AI_* env vars) — "
                  f"running heuristic compare only.{Style.RESET_ALL}")
        async def _run():
            stats = await compare_all_brands(db, provider)
            print(f"Compared {stats['brands']} brands / {stats['offers']} offers, "
                  f"archived {stats['archived']} duplicates")
            close()
        asyncio.run(_run()); return
    if args.reverify:
        from app.workers.verifier import reverify_all
        db = connect()
        async def _run():
            async with create_shared_client() as client:
                stats = await reverify_all(db, client)
                print(f"Checked {stats['checked']} offers across {stats['sources']} sources, "
                      f"expired {stats['expired']} dead codes")
            close()
        asyncio.run(_run()); return
    if args.sources:
        asyncio.run(discover_from_sources(max_per_source=args.max_per_source, force=args.force)); return
    if args.stale: asyncio.run(discover_all(stale_hours=24)); return
    if args.scan:
        names = [n.strip() for n in args.names.split(",")] if args.names else None
        asyncio.run(discover_all(max_brands=args.max, names=names)); return
    p.print_help()

if __name__ == "__main__":
    main()