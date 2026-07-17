import re
from typing import Optional

DISCOUNT_RE = re.compile(
    r'(\d+%)\s*off|\$(\d+)\s*off|save\s+\$?(\d+|up\s+to\s+\d+%)|'
    r'free\s+(trial|shipping|delivery|domain)|'
    r'(\d+%)\s+discount|'
    r'just\s+\$?(\d+)\/(mo|month|year)|'
    r'starting at\s+\$?(\d+)',
    re.IGNORECASE
)

def extract_discount_value(text: str) -> Optional[str]:
    m = DISCOUNT_RE.search(text)
    return m.group(0).strip() if m else None
