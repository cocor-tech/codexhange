from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

class Deal(BaseModel):
    store_name: str
    deal_type: str = Field(description="code / sale / free_trial / student_discount")
    code: Optional[str] = None
    title: str
    description: Optional[str] = None
    destination_url: str
    source_page: str = ""
    confidence_score: int = Field(default=50, ge=0, le=99)
    scraped_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    strategy: str = ""
    countries: list = Field(default_factory=list)
    discount_value: Optional[str] = None
    expiry_text: Optional[str] = None
    blocked: bool = False
    blocked_reason: str = ""

class ScanJob(BaseModel):
    brand_id: str = ""
    brand_name: str = ""
    source_url: str
    source_type: str = "url_patterns"
    status: str = "pending"
    priority: int = Field(default=0, ge=0, le=10)
    attempts: int = Field(default=0, ge=0)
    error: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
