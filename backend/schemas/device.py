from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class DeviceRegisterRequest(BaseModel):
    """Request schema for registering a new device."""
    device_id: str   
    name:      str   


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
    last_seen:  Optional[datetime]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]