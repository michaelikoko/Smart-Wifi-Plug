from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Literal
from datetime import date as date_type

TIME_PATTERN = r"^([01]\d|2[0-3]):([0-5]\d)$"  # 24-hour HH:MM, zero-padded


class TimerCreate(BaseModel):
    """Schema for creating a new device timer."""

    name: Optional[str] = Field(default=None, max_length=100)
    time: str = Field(pattern=TIME_PATTERN, description="24-hour HH:MM, e.g. '06:30'")
    action: Literal["ON", "OFF"]
    is_enabled: bool = True


class TimerUpdate(BaseModel):
    """Schema for partially updating a device timer. All fields optional."""

    name: Optional[str] = Field(default=None, max_length=100)
    time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)
    action: Optional[Literal["ON", "OFF"]] = None
    is_enabled: Optional[bool] = None


class TimerResponse(BaseModel):
    """Response schema for a device timer."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    device_id: str
    name: Optional[str]
    time: str
    action: str
    is_enabled: bool
    last_triggered_date: Optional[date_type]
