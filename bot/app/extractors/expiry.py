import re
from datetime import datetime, timezone, timedelta
from typing import Optional

MONTHS = r"(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)"

def extract_expiry(text: str) -> Optional[datetime]:
    if not text: return None
    t = text.strip().lower()
    now = datetime.now(timezone.utc)

    patterns = [
        r"(?:expires?|ends?|valid\s+(?:until?|till?|through?))\s+" + MONTHS + r"\s+(\d{1,2})(?:,?\s*(\d{4}))?",
        r"(?:expires?|ends?|valid\s+(?:until?|till?|through?))\s+(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?",
        r"(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})",
        r"(?:expires?|ends?)\s+in\s+(\d+)\s+days?",
        r"(?:valid\s+for|for)\s+(\d+)\s+days?",
    ]

    m = re.search(patterns[0], t, re.I)
    if m:
        month = datetime.strptime(m.group(1).capitalize()[:3], "%b").month
        day = int(m.group(2))
        year = int(m.group(3)) if m.group(3) else now.year
        try: return datetime(year, month, day, tzinfo=timezone.utc)
        except: pass

    m = re.search(patterns[1], t, re.I)
    if m:
        a, b, c = int(m.group(1)), int(m.group(2)), m.group(3)
        if c:
            year = 2000 + int(c) if int(c) < 100 else int(c)
            for d in [(year, a, b), (year, b, a)]:
                try: return datetime(*d, tzinfo=timezone.utc)
                except: pass

    m = re.search(patterns[3], t, re.I) or re.search(patterns[4], t, re.I)
    if m:
        days = int(m.group(1))
        if days <= 365: return now + timedelta(days=days)

    if any(k in t for k in ["limited time", "offer ends soon", "while supplies last"]):
        return now + timedelta(days=30)

    return None
