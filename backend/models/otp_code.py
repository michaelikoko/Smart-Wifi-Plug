from datetime import datetime, timezone
from enum import Enum
from typing import Optional, ClassVar
from sqlmodel import Field, SQLModel, DateTime, Column


class OtpPurpose(str, Enum):
    EMAIL_VERIFICATION = "email_verification"
    PASSWORD_RESET = "password_reset"


class OtpCode(SQLModel, table=True):
    """
    Generic OTP table, reused for email verification and password reset.

    Security notes:
      - We store a HASH of the OTP, never the plaintext (same threat model
        as passwords — a DB leak shouldn't reveal valid codes).
      - `attempts` caps brute-force guesses (max 5).
      - `consumed` makes the OTP single-use even if not expired.
      - One active (unconsumed, unexpired) OTP per (user, purpose) is
        enforced at the application layer: issuing a new OTP for the
        same purpose invalidates prior ones for that user.
    """

    __tablename__: ClassVar[str] = "otp_codes"

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(foreign_key="users.id", index=True)
    purpose: OtpPurpose = Field(index=True)

    otp_hash: str

    attempts: int = Field(default=0)
    consumed: bool = Field(default=False)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True)),
    )
    expires_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
        ),
    )
