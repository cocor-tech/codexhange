"""
Scan a single source URL and return extracted deals.
Used both by the batch pipeline and the admin Deal Scanner.
"""
from bs4 import BeautifulSoup
from app.services.fetcher import smart_fetch, fetch_direct, is_cloudflare
from app.extractors import extract_codes_from_soup, detect_countries, extract_discount_value, extract_expiry
from app.services.classifier import classify

async def scan_source(client, url: str, brand_name: str = "") -> dict:
    url = url.strip().rstrip("/")
    result = {
        "url": url, "success": False, "status": 0, "source": "direct",
        "blocked": False, "blocked_reason": "", "title": "", "codes": [],
        "countries": [], "deal_type": "", "discount": "", "expiry": None,
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

    except Exception as e:
        result["error"] = str(e)[:200]

    return result
