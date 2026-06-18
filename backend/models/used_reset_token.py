from datetime import datetime, timezone
from typing import Optional, ClassVar, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship, Column, DateTime, func

if TYPE_CHECKING:
    from models.user import User


class UsedResetToken(SQLModel, table=True):
    """
    Records the `jti` of password-reset tokens that have been consumed.

    The reset token itself is short-lived (10 min) and signed, but JWTs are
    stateless by nature — without this table, a valid-but-used token could
    be replayed until it expires. Recording the `jti` on first use makes the
    token single-use regardless of remaining validity.

    A periodic cleanup job can delete rows where created_at is older than
    the max reset-token expiry (e.g. > 1 hour).
    """

    __tablename__: ClassVar[str] = "used_reset_tokens"

    jti: str = Field(primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(
            # pylint: disable=not-callable
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=True,
        ),
    )
    user: Optional["User"] = Relationship(back_populates="used_reset_tokens")
