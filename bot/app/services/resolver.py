"""
Resolve redirect/affiliate links ("Shop Now" / "Get Code" buttons) to the
final merchant URL by following the full redirect chain.
"""
import re
import httpx
from urllib.parse import urlparse, urljoin, parse_qs, urlencode, urlunparse

TRACKING_PARAMS = [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "affid", "aff_id", "affiliate_id", "affiliateid", "ref", "referral",
    "subid", "sub_id", "click_id", "clickid", "pid", "pub_id", "pubid",
    "siteid", "site_id", "sid", "tracking_id", "trackingid", "irclickid",
    "s_kwcid", "gclid", "dclid", "fbclid", "gbraid", "wbraid", "mc_cid",
    "mc_eid", "cmpid", "ocid", "tag", "cjevent", "mkwid", "pcrid",
]

REDIRECT_DOMAINS = [
    "linksynergy.com", "awin1.com", "tradedoubler.com", "tradehouse.media",
    "impact.com", "impactradius.com", "clickbank.net", "jvzoo.com",
    "cj.com", "commissionjunction.com", "skimresources.com", "skimlinks.com",
    "viglink.com", "shareasale.com", "go.affiliate.com", "affiliatly.com",
    "refersion.com", "partnero.com", "getrewardful.com", "firstpromoter.com",
    "tapfiliate.com", "pabbly.com", "deeplink.me", "bit.ly", "tinyurl.com",
    "redirectingat.com", "go.redirectingat.com", "r.kounta.com", "trk.com",
    "ad.doubleclick.net", "click.linksynergy.com", "go.magik.ly", "magik.ly",
    "clickbank.net", "hop.clickbank.net", "track.affiliatly.com",
    "aff.dpbolvw.net", "click.dpbolvw.net", "www.jdoqocy.com", "www.tkqlhce.com",
    "www.awltovhc.com", "www.kqzyfj.com", "www.qksrv.net", "www.emjcd.com",
    "www.dpbolvw.net", "click.linksynergy.com", "goto.target.com", "go.skimresources.com",
]

REDIRECT_PATH_RE = re.compile(
    r'/out/|/go/|/redirect|/track|/click|/c/|/away|/out\.php|/redirect\.php|/link\.php|'
    r'/goto|/hop/|/rd/|/r/|/clk/|/bit\.ly|/redirect\.aspx|/redir|/c\.php|/track\.php',
    re.I,
)

REDIRECT_QUERY_RE = re.compile(
    r'(^|&)(url|dest|destination|target|redirect|redirect_url|redirect_uri|goto|out|u|r)=',
    re.I,
)


def clean_tracking_params(url: str) -> str:
    """Strip common affiliate/tracking query params from a URL."""
    try:
        parsed = urlparse(url)
        if not parsed.query:
            return url
        keep = {k: v for k, v in parse_qs(parsed.query).items()
                if k.lower() not in TRACKING_PARAMS}
        if not keep:
            return urlunparse(parsed._replace(query=""))
        return urlunparse(parsed._replace(query=urlencode(keep, doseq=True)))
    except Exception:
        return url


def is_redirect_domain(domain: str) -> bool:
    d = domain.lower()
    return any(d == r or d.endswith("." + r) for r in REDIRECT_DOMAINS)


def looks_like_redirect(url: str) -> bool:
    try:
        parsed = urlparse(url)
        path = parsed.path.lower()
        query = parsed.query.lower()
        if is_redirect_domain(parsed.netloc):
            return True
        if REDIRECT_PATH_RE.search(path):
            return True
        if REDIRECT_QUERY_RE.search(query):
            return True
    except Exception:
        pass
    return False


META_REFRESH_RE = re.compile(
    r'<meta[^>]+http-equiv=["\']?refresh["\']?[^>]*content=["\']?\d*;?\s*url=["\']?([^"\'>\s]+)',
    re.I,
)
JS_REDIRECT_RE = re.compile(
    r'(?:window\.)?location\.(?:href|replace|assign)\s*(?:=\s*|\(\s*)[\'"]([^\'"]+)[\'"]\s*\)?',
    re.I,
)


async def resolve_final_url(client, url: str, max_hops: int = 6) -> dict:
    """Follow the redirect chain and return the final (real) URL.

    Handles HTTP 30x redirects hop-by-hop (so we can count hops and stop loops),
    httpx TooManyRedirects (retries with fewer auto-followed hops), and
    meta-refresh / JS `location.href` redirect pages.

    Returns:
        {"final_url": str, "hops": int, "domain": str, "via": str, "ok": bool}
    """
    current = url.strip()
    hops = 0
    visited = set()
    via = []

    def _domain(u: str) -> str:
        try:
            return urlparse(u).netloc.lower().replace("www.", "")
        except Exception:
            return ""

    while hops < max_hops:
        if current in visited:
            break
        visited.add(current)
        via.append(current)
        hops += 1

        try:
            r = await client.get(current, follow_redirects=False, timeout=6.0)
        except httpx.TooManyRedirects:
            # The auto-follower hit its redirect cap without resolving; the
            # location header of the last response tells us where to go next.
            continue
        except Exception:
            break

        # HTTP redirect chain hop
        if r.status_code in (301, 302, 303, 307, 308):
            loc = r.headers.get("location")
            if not loc:
                break
            current = urljoin(current, loc)
            continue

        if r.status_code != 200:
            break

        # 200 page: check meta refresh / JS redirect
        head = (r.text or "")[:20000]
        m = META_REFRESH_RE.search(head)
        if m:
            current = urljoin(current, m.group(1))
            continue
        m = JS_REDIRECT_RE.search(head)
        if m:
            current = urljoin(current, m.group(1))
            continue
        break

    final = clean_tracking_params(current)
    return {
        "final_url": final,
        "hops": hops,
        "domain": _domain(final),
        "via": via,
        "ok": bool(final.startswith("http")),
    }


def extract_outbound_links(base: str, soup, exclude_domain: str = "") -> list:
    """Find outbound merchant links (Shop Now / Get Code buttons) on a page.

    Returns list of {"url": str, "text": str, "is_redirect": bool}
    """
    from urllib.parse import urlparse as _p
    base_host = _p(base).netloc.lower().replace("www.", "")
    exclude = exclude_domain.lower().replace("www.", "")
    out = []
    seen = set()
    for a in soup.find_all("a", href=True):
        try:
            full = urljoin(base, a["href"])
            host = _p(full).netloc.lower().replace("www.", "")
        except Exception:
            continue
        text = a.get_text(strip=True)[:80].lower()
        if not full.startswith("http"):
            continue
        if host == base_host or host == exclude:
            continue
        key = full.rstrip("/").lower()
        if key in seen:
            continue
        seen.add(key)
        out.append({"url": full, "text": text, "is_redirect": looks_like_redirect(full)})
    return out