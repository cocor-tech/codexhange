import httpx
from fake_useragent import UserAgent

try:
    _ua = UserAgent(fallback="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
except Exception:
    _ua = None

def get_random_user_agent() -> str:
    if _ua:
        return _ua.random
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def create_shared_client() -> httpx.AsyncClient:
    limits = httpx.Limits(
        max_keepalive_connections=30,
        max_connections=100,
        keepalive_expiry=5.0,
    )
    timeout = httpx.Timeout(5.0, read=4.0, write=4.0, connect=2.0)
    headers = {
        "User-Agent": get_random_user_agent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.google.com/",
        "DNT": "1",
    }
    return httpx.AsyncClient(
        limits=limits,
        timeout=timeout,
        headers=headers,
        follow_redirects=True,
    )
