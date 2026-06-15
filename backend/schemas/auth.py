from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, TypedDict, Literal
from datetime import datetime

class RegisterRequest(BaseModel):
    """
    Request schema for user registration.
    """
    email:    EmailStr
    password: str
    confirm_password: str
    full_name: str


class LoginRequest(BaseModel):
    """
    Request schema for user login.
    """
    email:    EmailStr
    password: str

class RefreshRequest(BaseModel):
    """
    Request schema for token refresh.
    """
    refresh_token: str

class TokenPayloadBase(TypedDict):
    """
    Payload schema for JWT token.
    """
    email: str
    sub:   str
    exp:   datetime

class AccessTokenPayload(TokenPayloadBase):
    """
    Payload schema for JWT access token.
    """
    type: Literal["access"]

class RefreshTokenPayload(TokenPayloadBase):
    """
    Payload schema for JWT refresh token, which includes a `jti` for rotation and reuse detection.
    """
    type: Literal["refresh"]
    jti: Optional[str]  # JWT ID for refresh tokens, used for rotation and reuse detection

class ResetTokenPayload(TokenPayloadBase):
    """
    Payload schema for password reset JWT token, issued after successful OTP verification.
    """
    type: Literal["reset"]
    jti: Optional[str]  # JWT ID for reset tokens, used for single-use enforcement

class TokenResponse(BaseModel):
    """
    Response schema for the token endpoint.
    """
    access_token: str
    refresh_token: str
    token_type:   str = "bearer"


class UserResponse(BaseModel):
    """
    Response schema for user information.
    """
    model_config = ConfigDict(from_attributes=True)
    id:         int
    email:      str
    full_name:  str
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ForgotPasswordRequest(BaseModel):
    """
    Forgot password request schema.
    """
    email: EmailStr
 
class ForgotPasswordResponse(BaseModel):
    """
    Forgot password response schema.
    The same message is returned regardless of whether the email exists, to prevent user enumeration.
    """
    message: str = "If an account exists for this email, a code has been sent."
 
class VerifyResetOtpRequest(BaseModel):
    """
    Verify reset password OTP request schema.
    """
    email: EmailStr
    otp: str
 
class VerifyResetOtpResponse(BaseModel):
    """
    Verify reset password OTP response schema.
    On success, returns a short-lived reset token for the next step of the password reset flow.
    - The reset token is single-use and expires after a short time (e.g. 15 minutes).
    - It is stored in the database to enforce single-use and allow revocation after use.
    """
    reset_token: str
 
class ResetPasswordRequest(BaseModel):
    """
    Reset password request schema.
    """
    new_password: str
    confirm_password: str
 
class ResetPasswordResponse(BaseModel):
    """
    Reset password response schema.
    """
    message: str = "Password updated successfully"