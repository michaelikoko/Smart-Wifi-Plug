from datetime import datetime
from typing import Optional

from pydantic import ConfigDict
from sqlmodel import SQLModel


class EnergyEventResponse(SQLModel):
    model_config = ConfigDict(from_attributes=True)  # type: ignore[assignment]

    id: int
    device_id: str
    user_id: int
    event_type: str
    period: str
    period_key: str
    kwh_at_event: float
    limit_kwh: float
    is_read: bool
    created_at: Optional[datetime]


class EventListResponse(SQLModel):
    total: int
    limit: int
    offset: int
    events: list[EnergyEventResponse]

class MarkAllReadResponse(SQLModel):
    """Response schema for the bulk mark-all-read endpoint."""
    marked_read: int