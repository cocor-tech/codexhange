from datetime import datetime, timezone
from typing import Optional

def is_expired(expires_at: Optional[datetime]) -> bool:
    if not expires_at: return False
    return expires_at < datetime.now(timezone.utc)

def is_duplicate(existing_codes: list, new_code: Optional[str]) -> bool:
    if not new_code or not existing_codes: return False
    return new_code.upper() in [c.upper() for c in existing_codes if c]
