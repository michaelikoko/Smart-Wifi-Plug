from pydantic import BaseModel, ConfigDict
from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime

class DeviceRegisterRequest(BaseModel):
    """Request schema for registering a new device."""
    device_id: str   
    name:      str   

class UpdateDeviceRequest(BaseModel):
    """Request schema for updating a device's name."""
    name: str

class DeviceResponse(BaseModel):
    """Response schema for device information."""
    model_config = ConfigDict(from_attributes=True)
    id:         int
    device_id:  str
    user_id:    Optional[int]
    name:       str
    relay_state: bool
    is_enabled:  bool
    is_online: bool
    daily_limit_kwh: Optional[float] = None
    monthly_limit_kwh: Optional[float] = None
    auto_cutoff_enabled: bool = False
    cutoff_reason: Optional[str] = None
    cutoff_at: Optional[datetime] = None
    timer_lock_reason: Optional[str] = None
    timer_locked_at: Optional[datetime] = None
    last_seen:  Optional[datetime]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]


class UpdateDeviceLimitsRequest(SQLModel):
    daily_limit_kwh: Optional[float] = Field(default=None, gt=0)
    monthly_limit_kwh: Optional[float] = Field(default=None, gt=0)
    auto_cutoff_enabled: Optional[bool] = None