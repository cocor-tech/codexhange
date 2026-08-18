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
        result["codes"] = extract_codes_from_soup(soup, url, brand_name)
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

    except Exception as e:
        result["error"] = str(e)[:200]

    return result
