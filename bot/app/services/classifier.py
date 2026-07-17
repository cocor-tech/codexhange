import re
from typing import Optional

def clean_code(raw: Optional[str]) -> Optional[str]:
    if not raw: return None
    cleaned = raw.strip().upper()
    if len(cleaned) > 25 or " " in cleaned: return None
    if not re.match(r"^[A-Z0-9_\-+]+$", cleaned): return None
    return cleaned

def classify(title: str, description: str, code: Optional[str]) -> str:
    combined = f"{title} {description or ''}".lower()
    if clean_code(code): return "code"
    if any(k in combined for k in ["free trial","try free","free month","30 days free","no-risk trial","free access","free account","free premium"]):
        return "free_trial"
    if any(k in combined for k in ["student","education","edu discount","military","teacher","student discount"]):
        return "student_discount"
    return "sale"
