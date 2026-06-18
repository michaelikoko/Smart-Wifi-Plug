from typing import Optional, ClassVar, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Column, DateTime, func, Relationship
from datetime import datetime
from pydantic import EmailStr

if TYPE_CHECKING:
    from models.device import Device
    from models.refresh_token import RefreshToken
    from models.used_reset_token import UsedResetToken

class User(SQLModel, table=True):
    """
    Registered user account.
    Password is stored as a bcrypt hash — never plaintext.
    """

    __tablename__: ClassVar[str] = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    full_name: str = Field(index=True, min_length=1, max_length=255)
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    password_hash: str = Field(nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    billing_rate: Optional[int] = Field(default=None) # The cost per kWh in kobo.
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(
            # pylint: disable=not-callable
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=True,
        )
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(
            # pylint: disable=not-callable
            DateTime(timezone=True),
            onupdate=func.now(),
            server_default=func.now(),
            nullable=True,
        )
    )

    devices: list["Device"] = Relationship(back_populates="user")
    refresh_tokens: list["RefreshToken"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete"}
    )
    used_reset_tokens: list["UsedResetToken"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete"}
    )
