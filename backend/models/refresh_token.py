from datetime import datetime, timezone
from typing import Optional
from typing import ClassVar, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship, DateTime, Column

if TYPE_CHECKING:
    from models.user import User


class RefreshToken(SQLModel, table=True):
    """
    Persisted refresh tokens enable:
      - Rotation  — old token is revoked when a new one is issued.
      - Revocation — logout invalidates the token immediately.
      - Reuse detection — if an already-revoked token is presented,
        we know the token was stolen and can revoke the entire family.
    """

    __tablename__: ClassVar[str] = "refresh_token"

    id: Optional[int] = Field(default=None, primary_key=True)
    token: str = Field(index=True, unique=True)

    user_id: int = Field(foreign_key="users.id", index=True)

    revoked: bool = Field(default=False)

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

    user: Optional["User"] = Relationship(back_populates="refresh_tokens")