"""
Resolve redirect/affiliate links ("Shop Now" / "Get Code" buttons) to the
final merchant URL by following the full redirect chain.
"""
import re
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
]


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
        if is_redirect_domain(parsed.netloc):
            return True
        if re.search(r'/out/|/go/|/redirect|/track|/click|/c/|/away|/out\.php|/redirect\.php|/link\.php|/goto', path):
            return True
        if any(p in path for p in ["/out?", "?out=", "&url=", "?url=", "?dest=", "?target=", "?goto=", "?r="]):
            return True
    except Exception:
        pass
    return False


async def resolve_final_url(client, url: str, max_hops: int = 5) -> dict:
    """Follow the redirect chain and return the final (real) URL.

    Returns:
        {"final_url": str, "hops": int, "domain": str, "via": str, "ok": bool}
    """
    current = url.strip()
    hops = 0
    visited = set()
    via = []

    while hops < max_hops:
        if current in visited:
            break
        visited.add(current)
        try:
            r = await client.get(current, follow_redirects=True, timeout=6.0)
            final = str(r.url)
            hops += 1
            via.append(current)
            if final == current:
                break
            # If final URL is itself a redirect domain/endpoint, loop to follow it
            if looks_like_redirect(final) and final not in visited and hops < max_hops:
                current = final
                continue
            current = final
            break
        except Exception:
            break

    final = clean_tracking_params(current)
    try:
        domain = urlparse(final).netloc.lower().replace("www.", "")
    except Exception:
        domain = ""

    return {
        "final_url": final,
        "hops": hops,
        "domain": domain,
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