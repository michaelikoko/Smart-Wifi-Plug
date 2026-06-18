from schemas.device import DeviceResponse
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime

class UserResponse(BaseModel):
    """
    Response schema for user information.
    """
    model_config = ConfigDict(from_attributes=True)
    id:         int
    email:      str
    full_name:  str
    is_active: bool
    billing_rate: Optional[int] #The cost per kWh in kobo.
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    devices: list[DeviceResponse]


class UpdateBillingRateRequest(BaseModel):
    """Schema for updating the user's global billing_rate."""
    # ge=0 ensures the rate cannot be a negative number
    billing_rate: int = Field(ge=1, description="Cost per kWh in smallest currency unit (i.e, kobo)")