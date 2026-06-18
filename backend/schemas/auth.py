from pydantic import BaseModel, EmailStr, model_validator
from typing import Literal
from datetime import datetime

class RegisterRequest(BaseModel):
    """
    Request schema for user registration.
    """
    email:    EmailStr
    password: str
    confirm_password: str
    full_name: str

    @model_validator(mode='after')
    def check_passwords_match(self) -> 'RegisterRequest':
        """
        Validator to ensure that the password and confirm_password fields match.
        """
        if self.password != self.confirm_password:
            raise ValueError('Passwords do not match')
        return self


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

class TokenPayloadBase(BaseModel):
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
    jti: str  # JWT ID for refresh tokens, used for rotation and reuse detection

class ResetTokenPayload(TokenPayloadBase):
    """
    Payload schema for password reset JWT token, issued after successful OTP verification.
    """
    type: Literal["reset"]
    jti: str  # JWT ID for reset tokens, used for single-use enforcement

class TokenResponse(BaseModel):
    """
    Response schema for the token endpoint.
    """
    access_token: str
    refresh_token: str
    token_type:   str = "bearer"

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

    @model_validator(mode='after')
    def check_passwords_match(self) -> 'ResetPasswordRequest':
        """
        Validator to ensure that the new_password and confirm_password fields match.
        """
        if self.new_password != self.confirm_password:
            raise ValueError('Passwords do not match')
        return self
    
class ResetPasswordResponse(BaseModel):
    """
    Reset password response schema.
    """
    message: str = "Password updated successfully"