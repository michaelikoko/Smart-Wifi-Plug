from datetime import datetime
from enum import Enum
from typing import Optional, ClassVar, TYPE_CHECKING

from sqlalchemy import UniqueConstraint, Column, ForeignKey, String, Integer
from sqlmodel import SQLModel, Field, DateTime, func, Relationship


if TYPE_CHECKING:
    from models.device import Device


class EnergyEventType(str, Enum):
    DAILY_LIMIT_REACHED = "daily_limit_reached"
    MONTHLY_LIMIT_REACHED = "monthly_limit_reached"


class EnergyEventPeriod(str, Enum):
    DAILY = "daily"
    MONTHLY = "monthly"


class EnergyEvent(SQLModel, table=True):
    __tablename__: ClassVar[str] = "energy_events"
    __table_args__ = (
        UniqueConstraint(
            "device_id",
            "event_type",
            "period_key",
            name="uq_energy_event_device_type_period",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    device_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("devices.device_id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    event_type: EnergyEventType = Field(nullable=False)
    period: EnergyEventPeriod = Field(nullable=False)
    period_key: str = Field(nullable=False)
    kwh_at_event: float = Field(nullable=False)
    limit_kwh: float = Field(nullable=False)
    is_read: bool = Field(default=False, nullable=False)
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            # pylint: disable=not-callable
            server_default=func.now(),
            nullable=True,
        ),
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            # pylint: disable=not-callable
            onupdate=func.now(),
            
            # pylint: disable=not-callable
            server_default=func.now(),
            nullable=True,
        ),
    )

    device: Optional["Device"] = Relationship(back_populates="energy_events")