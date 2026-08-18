"""
Scan a single source URL and return extracted deals.
Used both by the batch pipeline and the admin Deal Scanner.
"""
import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from app.services.fetcher import smart_fetch, fetch_direct, is_cloudflare
from app.extractors import extract_codes_from_soup, detect_countries, extract_discount_value, extract_expiry
from app.extractors.codes import validate_code
from app.services.classifier import classify
from app.services.ai_provider import get_provider
from app.services.resolver import extract_outbound_links, resolve_final_url, is_redirect_domain

# Social-share / login / consent endpoints are redirect links too, but they
# never lead to a merchant checkout — exclude them from deal resolution.
OUTBOUND_SKIP_DOMAINS = {
    "twitter.com", "x.com", "facebook.com", "m.facebook.com", "linkedin.com",
    "youtube.com", "m.youtube.com", "instagram.com", "reddit.com",
    "pinterest.com", "whatsapp.com", "wa.me", "t.me", "telegram.me",
    "consent.google.com", "consent.youtube.com", "accounts.google.com",
}
OUTBOUND_SKIP_PATH_RE = re.compile(r"/share|/intent|/sharer|/login|/signin|consent\.", re.I)
OUTBOUND_DEAL_TEXT = re.compile(r"code|coupon|deal|save|shop|offer|promo|get|reveal|voucher|buy|order|checkout", re.I)
SKIP_MERCHANT_LINKS = {"facebook.com", "x.com", "twitter.com", "instagram.com", "linkedin.com", "youtube.com"}

# Page titles that indicate a soft-404 (HTTP 200 with a "not found" template)
SOFT_404_TITLE_KW = [
    "page not found", "404 not found", "404 error", "error 404",
    "this page does not exist", "this page doesn't exist", "page unavailable",
    "page could not be found", "we can't find", "we cannot find",
    "not found (404)", "404 - not found", "404 | not found", "oops!",
]

async def scan_source(client, url: str, brand_name: str = "", db=None) -> dict:
    url = url.strip().rstrip("/")
    result = {
        "url": url, "success": False, "status": 0, "source": "direct",
        "blocked": False, "blocked_reason": "", "title": "", "codes": [],
        "promo_links": [], "outbound_links": [], "countries": [], "deal_type": "", "discount": "", "expiry": None,
        "error": "",
    }
    try:
        fetch_result = await smart_fetch(client, url, timeout=6.0)
        result["status"] = fetch_result["status"]
        result["source"] = fetch_result.get("source", "direct")
        result["blocked"] = fetch_result.get("blocked", False)
        text = fetch_result.get("text", "")

        if fetch_result.get("blocked") or is_cloudflare(text):
            result["blocked_reason"] = "cloudflare"
            return result

        if fetch_result["status"] != 200:
            result["error"] = f"HTTP {fetch_result['status']}"
            return result

        if not text or len(text) < 200:
            result["error"] = "Page too short"
            return result

        soup = BeautifulSoup(text, "lxml")
        title_el = soup.find("title")
        result["title"] = title_el.get_text(strip=True) if title_el else ""
        result["page_text"] = text[:20000]

        # Soft-404 detection: HTTP 200 but the page is really a "not found"
        # page (404 templates from e.g. bestbuy.com). Never extract codes
        # from these — they'd produce garbage offers like title="Oops Page
        # Not Found!" with a bogus code.
        title_l = result["title"].lower()
        body_head = " ".join(soup.get_text(" ", strip=True)[:1500].lower().split())
        if not title_l and len(body_head) < 60:
            result["error"] = "Empty page (no title)"
            return result
        if any(kw in title_l for kw in SOFT_404_TITLE_KW) or (
            "not found" in title_l and ("page" in title_l or "error" in title_l)
        ):
            result["error"] = "Soft 404 page"
            return result

        result["codes"] = extract_codes_from_soup(soup, url, brand_name)
        result["is_code"] = bool(result["codes"])
        result["discount"] = extract_discount_value(soup.get_text()) or ""
        result["countries"] = detect_countries(url, text, brand_name)
        result["expiry"] = extract_expiry(soup.get_text())
        result["deal_type"] = classify(result["title"], "", result["codes"][0] if result["codes"] else None)
        result["success"] = True

        # -- AI fallback: extract codes + promo links the regex missed --
        try:
            if db is not None:
                from app.workers.enricher import load_provider
                provider = load_provider(db)
            else:
                provider = get_provider()
        except Exception:
            provider = None

        if provider is not None:
            try:
                ai_codes = await provider.detect_codes(soup.get_text(), brand_name)
                if ai_codes:
                    seen = set(result["codes"])
                    for c in ai_codes:
                        v = validate_code(c)
                        if v and v not in seen:
                            result["codes"].append(v)
                            seen.add(v)
            except Exception:
                pass
            # AI confirmed: the page is a code page, or it's a link/deal page.
            result["is_code"] = bool(result["codes"])
            result["deal_type"] = classify(result["title"], "", result["codes"][0] if result["codes"] else None)

            try:
                links = []
                for a in soup.find_all("a", href=True):
                    href = a["href"].strip()
                    if href.startswith("#") or href.startswith("javascript:"):
                        continue
                    txt = a.get_text(strip=True)
                    if not txt:
                        continue
                    links.append({"href": href, "text": txt[:80]})
                ai_links = await provider.classify_promo_links(links, brand_name)
                promos = []
                for l in ai_links:
                    full = urljoin(url, l)
                    if full.startswith("http") and full not in promos:
                        promos.append(full)
                result["promo_links"] = promos[:5]
            except Exception:
                pass

        # -- outbound merchant links (Shop Now / Get Code) -> resolve redirects --
        try:
            outbound = []
            for l in extract_outbound_links(url, soup):
                if not l["is_redirect"]:
                    continue
                try:
                    host = urlparse(l["url"]).netloc.lower().replace("www.", "")
                    skip = host in OUTBOUND_SKIP_DOMAINS or \
                        any(host == d or host.endswith("." + d) for d in OUTBOUND_SKIP_DOMAINS) or \
                        OUTBOUND_SKIP_PATH_RE.search(l["url"])
                    if skip:
                        continue
                    if not OUTBOUND_DEAL_TEXT.search(l["text"]):
                        continue
                except Exception:
                    continue
                res = await resolve_final_url(client, l["url"])
                if res["ok"] and res["domain"] and not is_redirect_domain(res["domain"]):
                    outbound.append({
                        "url": l["url"],
                        "final_url": res["final_url"],
                        "domain": res["domain"],
                        "text": l["text"],
                        "hops": res["hops"],
                    })
            result["outbound_links"] = outbound
        except Exception:
            pass

        # -- extract the actual merchant website URL from aggregator pages --
        merchant_url = ""
        if not outbound:
            try:
                merchant_url = _extract_merchant_url(soup, url, brand_name)
                # Resolve through redirects to find the real booking site
                # (e.g. econolodge.com -> choicehotels.com)
                if merchant_url and client:
                    res = await resolve_final_url(client, merchant_url, max_hops=4)
                    if res.get("ok") and res.get("final_url"):
                        merchant_url = res["final_url"]
            except Exception:
                pass
        result["merchant_url"] = merchant_url

    except Exception as e:
        result["error"] = str(e)[:200]

    return result


MERCHANT_URL_RE = re.compile(
    r'(?:(?:https?://)?(?:www\.)?([a-z0-9][a-z0-9\-]{1,63}\.(?:com|net|org|co\.uk|ca|au|us|io|co)))',
    re.I,
)
WEBSITE_TEXT_RE = re.compile(
    r'(?:official\s+site|visit\s+site|go\s+to\s+site|shop\s+now\s+at|on\s+\w+\s+website|website)',
    re.I,
)


def _extract_merchant_url(soup, page_url: str, brand_name: str) -> str:
    """Try to find the actual merchant URL on an aggregator coupon page.

    Looks for: sidebar "Website" links, "on {Brand} Website" patterns,
    JSON-LD merchant URLs, meta tags.
    """
    from urllib.parse import urlparse as _p
    page_host = _p(page_url).netloc.lower().replace("www.", "")

    # 1. JSON-LD / structured data with merchant URL
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            import json
            data = json.loads(script.string or "")
            if not isinstance(data, dict):
                continue
            dtype = (data.get("@type") or "").lower()
            # WebPage sameAs often links to the real merchant (skip Organization, BreadcrumbList etc.)
            if dtype in ("webpage", "onlinestore", "product"):
                same_as = data.get("sameAs") or []
                if isinstance(same_as, str):
                    same_as = [same_as]
                for u in same_as:
                    if not u.startswith("http"):
                        continue
                    h = u.split("//")[-1].split("/")[0].lower().replace("www.", "")
                    if h != page_host and h not in SKIP_MERCHANT_LINKS:
                        return u
        except Exception:
            pass

    # 2. Sidebar "Website" link — aggregator pages often have a sidebar
    #    with <a href="https://brand.com">Website</a>
    brand_lower = brand_name.lower().replace(" ", "")
    for a in soup.find_all("a", href=True):
        try:
            href = a["href"].strip()
            text = a.get_text(strip=True).lower()
            if not href.startswith("http"):
                continue
            h = _p(href).netloc.lower().replace("www.", "")
            if h == page_host:
                continue
            if text in ("website", "official site", "visit site", "shop now"):
                return href
            if brand_lower in h.replace("-", "").replace(".", "") and text in ("website", "official site", f"{brand_name.lower()} website"):
                return href
        except Exception:
            continue

    # 3. "on {Brand} Website" text pattern → look for links near that text
    page_text = soup.get_text(" ", strip=True)
    pattern = re.compile(
        rf'(?:on|at|visit)\s+{re.escape(brand_name)}\s+website',
        re.I,
    )
    if pattern.search(page_text):
        # find all outbound links and prefer the brand's own domain
        for a in soup.find_all("a", href=True):
            try:
                href = a["href"].strip()
                if not href.startswith("http"):
                    continue
                h = _p(href).netloc.lower().replace("www.", "")
                if h == page_host:
                    continue
                if brand_lower in h.replace("-", "").replace(".", ""):
                    return href
            except Exception:
                continue

    # 4. Brute-force: find a link whose domain matches the brand name
    for a in soup.find_all("a", href=True):
        try:
            href = a["href"].strip()
            if not href.startswith("http"):
                continue
            h = _p(href).netloc.lower().replace("www.", "")
            if h == page_host:
                continue
            if brand_lower in h.replace("-", "").replace(".", ""):
                return href
        except Exception:
            continue

    return ""
