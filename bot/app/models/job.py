from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

class DiscoveredUrl(BaseModel):
    url: str
    source_type: str  # url_patterns, sitemap, homepage, link_discovery, crawler, search
    confidence: int = Field(default=0, ge=0, le=99)
    brand_name: str = ""
    brand_id: str = ""
