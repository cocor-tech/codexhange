import re
from bs4 import BeautifulSoup
from typing import Optional, List, Tuple

SKIP_CODES = {
    'THIS','THAT','FROM','WITH','HAVE','THAN','SHOP','HOME','PAGE','MENU',
    'CART','HELP','FREE','SALE','CODE','HTTP','HTTPS','WWW','HTML','CSS',
    'JSON','BLOG','TEXT','FILE','SIZE','TYPE','DATA','LINK','META','HEAD',
    'BODY','DIV','SPAN','FORM','MAIN','NAV','FOOT','COOKIE','CLICK','LOGIN',
    'SIGNUP','ABOUT','PRIVACY','TERMS','RETURN','ORDER','PRICE','VIEW',
    'EDIT','SAVE','LOAD','SEND','MAIL','USER','ADMIN','GUEST','TEMP',
    'TEST','DEMO','NONE','NULL','TRUE','FALSE','ENABLED','DISABLED',
    'NEXT','PREV','BACK','INFO','ERROR','ALERT','TITLE','LABEL','VALUE',
    'STYLE','CLASS','ID','NAME','INDEX','DEFAULT',
    'WHEN','THEN','LEADING','FOLLOW','AFTER','BEFORE','ABOVE','BELOW',
    'FIRST','LAST','MAIN','MENU','NAV','TAB','TABS',
}

def validate_code(raw: Optional[str]) -> Optional[str]:
    if not raw: return None
    cleaned = raw.strip().upper()
    if len(cleaned) < 4 or len(cleaned) > 25: return None
    if " " in cleaned: return None
    if not re.match(r'^[A-Z0-9_\-+]+$', cleaned): return None
    if cleaned in SKIP_CODES: return None
    if re.match(r'^\d+$', cleaned): return None
    return cleaned

def infer_code_from_url(url: str, brand_name: str = "") -> Optional[str]:
    path = url.split("?")[0].lower()
    m = re.search(r'/(?:promo|coupon|code|offer|deal|save|voucher|referral)/([a-z0-9_\-+]{4,25})(?:/|$|\.)', path)
    if m: return validate_code(m.group(1))
    m = re.search(r'[?&](?:code|coupon|promo|offer|ref|referral)=([a-z0-9_\-+]{4,25})(?:&|$)', url.lower())
    if m: return validate_code(m.group(1))
    if brand_name:
        slug = brand_name.lower().replace(" ", "").replace("-", "")[:10]
        for p in [rf'(?:try|save|use|get){slug}', rf'{slug}(?:20|save|deal|off|code)']:
            m = re.search(p, path)
            if m: return validate_code(m.group(0))
    return None

def extract_codes_from_soup(soup: BeautifulSoup, url: str = "", brand_name: str = "") -> List[str]:
    codes = set()
    html = str(soup) if soup else ""
    text = soup.get_text() if soup and hasattr(soup, "get_text") else ""
    if not html or len(html) < 100: return []

    # Pattern 1: Explicit labels
    for p in [
        re.compile(r'(?:code|coupon|promo|voucher|discount\s+code)[:\s]*["\'\(]*([A-Z0-9_\-]{4,25})["\'\)]*', re.I),
        re.compile(r'(?:use|enter|apply|try)\s+(?:code\s+|promo\s+|coupon\s+)?["\']?([A-Z0-9_\-]{4,25})["\']?', re.I),
    ]:
        for m in p.finditer(text):
            c = validate_code(m.group(1))
            if c: codes.add(c)

    # Pattern 2: Page title
    title_tag = soup.find("title")
    if title_tag:
        title_text = title_tag.get_text(strip=True)
        m = re.search(r'(?:offer|deal|code|coupon|promo|save)\s+(?:to\s+)?(?:viewers\s+)?([A-Za-z0-9_\-+]{4,25})(?:\s|$)', title_text, re.I)
        if m:
            c = validate_code(m.group(1))
            if c: codes.add(c)

    # Pattern 3: <code>, <kbd>, <samp> tags
    for tag in soup.find_all(["code", "kbd", "samp"]):
        c = validate_code(tag.get_text(strip=True))
        if c: codes.add(c)

    # Pattern 4: <input readonly value="CODE">
    for inp in soup.find_all("input", readonly=True):
        c = validate_code(inp.get("value", ""))
        if c: codes.add(c)

    # Pattern 5: Elements with coupon/promo class
    for cls_name in ["coupon", "coupon-code", "promo-code", "promo", "discount-code", "code-value", "copy-code"]:
        for el in soup.select(f"[class*='{cls_name}']"):
            c = validate_code(el.get_text(strip=True))
            if c: codes.add(c)
            for attr in ["data-code", "data-coupon", "data-promo", "data-clipboard-text"]:
                c2 = validate_code(el.get(attr, ""))
                if c2: codes.add(c2)

    # Pattern 6: Near "Copy" buttons — only when the surrounding container has
    # code-ish context, and never grab the button's own words.
    for btn in soup.find_all(["button", "a", "span"]):
        btn_text = btn.get_text(strip=True).lower()
        if "copyright" in btn_text:
            continue
        if not any(kw in btn_text for kw in ["copy code", "copy coupon", "copy"]):
            continue
        container = btn.parent
        candidates = [container]
        if container and len(container.get_text(" ", strip=True)) < 60 and container.parent:
            candidates.append(container.parent)
        for parent in candidates:
            if not parent:
                continue
            txt = parent.get_text(" ", strip=True)
            if 200 < len(txt) or len(txt) < 8:
                continue
            if not re.search(r'(code|coupon|promo|voucher|%|off|save|deal)', txt, re.I):
                continue
            btn_tokens = set(btn.get_text(strip=True).upper().split())
            for m in re.finditer(r'\b([A-Z0-9_\-]{4,20})\b', txt.upper()):
                c = validate_code(m.group(1))
                if c and m.group(1) not in btn_tokens:
                    codes.add(c)

    # Pattern 7: JSON-LD
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            import json
            data = json.loads(script.string)
            items = data.get("@graph", [data]) if isinstance(data, dict) else data
            for item in items:
                if isinstance(item, dict):
                    for key in ["code", "couponCode", "discountCode", "promoCode"]:
                        c = validate_code(str(item.get(key, "")))
                        if c: codes.add(c)
        except: pass

    # Pattern 8: Meta tags
    for meta in soup.find_all("meta"):
        name = (meta.get("name") or meta.get("property") or "").lower()
        content = meta.get("content", "")
        if any(kw in name for kw in ["coupon", "promo", "discount", "code"]):
            c = validate_code(content)
            if c: codes.add(c)

    # Pattern 9: Data attributes
    for attr in ["data-code", "data-coupon", "data-promo", "data-discount", "data-clipboard"]:
        for el in soup.find_all(attrs={attr: True}):
            c = validate_code(el[attr])
            if c: codes.add(c)

    # Pattern 10: URL inference
    if url:
        url_code = infer_code_from_url(url, brand_name)
        if url_code: codes.add(url_code)

    return list(codes)

def extract_codes_from_text(text: str, url: str = "", brand_name: str = "") -> List[str]:
    codes = set()
    text_upper = text.upper() if text else ""
    if not text or len(text) < 100: return []

    for p in [
        re.compile(r'(?:code|coupon|promo|voucher)[:\s]+["\'\(]*([A-Z0-9_\-]{4,25})["\'\)]*', re.I),
        re.compile(r'(?:use|enter|apply|try)\s+(?:code\s+)?["\']?([A-Z0-9_\-]{4,25})["\']?', re.I),
    ]:
        for m in p.finditer(text_upper):
            c = validate_code(m.group(1))
            if c: codes.add(c)

    if url:
        url_code = infer_code_from_url(url, brand_name)
        if url_code: codes.add(url_code)

    return list(codes)
