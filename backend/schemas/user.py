from schemas.device import DeviceResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator
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


class UpdateProfileRequest(BaseModel):
    """Schema for updating the user's full name."""
    full_name: str = Field(min_length=1, max_length=255)


class ChangePasswordRequest(BaseModel):
    """Schema for changing the authenticated user's password."""
    old_password: str
    new_password: str = Field(min_length=8)
    confirm_password: str

    @model_validator(mode='after')
    def check_passwords(self) -> 'ChangePasswordRequest':
        if self.new_password != self.confirm_password:
            raise ValueError('New password and confirmation do not match')
        if self.new_password == self.old_password:
            raise ValueError('New password must be different from current password')
        return self


class ChangePasswordResponse(BaseModel):
    """Response schema for a successful password change."""
    message: str = "Password updated successfully. Please log in again."