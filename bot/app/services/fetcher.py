import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

BLOCKED_KW = ["just a moment","checking your browser","cf-ray","cloudflare",
              "performing security","verifying you are human","please enable cookies"]

def is_cloudflare(text: str) -> bool:
    return any(kw in text.lower()[:2000] for kw in BLOCKED_KW)

@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.3),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout)))
async def fetch_direct(client: httpx.AsyncClient, url: str, timeout: float = 5.0) -> dict:
    r = await client.get(url, timeout=timeout)
    return {"url": str(r.url), "status": r.status_code, "text": r.text, "blocked": is_cloudflare(r.text), "source": "direct"}

async def fetch_google_cache(url: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as c:
            r = await c.get(f"https://webcache.googleusercontent.com/search?q=cache:{url}&strip=1&vwsrc=0",
                           headers={"User-Agent": "Mozilla/5.0"})
            if r.status_code == 200 and not is_cloudflare(r.text) and len(r.text) > 500:
                return {"url": url, "status": 200, "text": r.text, "blocked": False, "source": "google_cache"}
    except: pass
    return None

async def fetch_wayback(url: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as c:
            r = await c.get(f"https://web.archive.org/web/20260716200000/{url}", headers={"User-Agent": "Mozilla/5.0"})
            if r.status_code == 200 and not is_cloudflare(r.text) and len(r.text) > 500:
                return {"url": url, "status": 200, "text": r.text, "blocked": False, "source": "wayback"}
    except: pass
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as c:
            r = await c.get(f"https://web.archive.org/web/2025/{url}", headers={"User-Agent": "Mozilla/5.0"})
            if r.status_code == 200 and not is_cloudflare(r.text) and len(r.text) > 500:
                return {"url": url, "status": 200, "text": r.text, "blocked": False, "source": "wayback"}
    except: pass
    return None

async def smart_fetch(client: httpx.AsyncClient, url: str, timeout: float = 5.0) -> dict:
    result = await fetch_direct(client, url, timeout)
    if result["status"] == 200 and not result["blocked"] and len(result["text"]) > 200:
        return result
    if result["blocked"] or result["status"] in (403, 503):
        g = await fetch_google_cache(url)
        if g: return g
        w = await fetch_wayback(url)
        if w: return w
    return result
