from sqlmodel import SQLModel, Field, Column, DateTime, func, Relationship
from typing import Optional, ClassVar, TYPE_CHECKING
from datetime import datetime

if TYPE_CHECKING:
    from models.user import User
    from models.telemetry import TelemetryReading, DeviceDailySummary


class Device(SQLModel, table=True):
    """
    A registered smart plug linked to a user account.

    device_id   — the unique ID embedded in the ESP32 firmware
                  (e.g. "esp32-smartplug-001"), used as the MQTT topic segment
    user_id     — FK to the user who registered this device
    last_seen   — updated on every telemetry message received by the MQTT handler
    """

    __tablename__: ClassVar[str] = "devices"

    id: Optional[int] = Field(default=None, primary_key=True)
    device_id: str = Field(unique=True, index=True)
    user_id: Optional[int] = Field(
        default=None,
        foreign_key="users.id",
        index=True,
        ondelete="SET NULL"
    )
    name: str
    relay_state: bool = False
    is_enabled: bool = Field(default=False, nullable=False)
    is_online: bool = Field(default=False)
    last_seen: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
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
    user: Optional["User"] = Relationship(back_populates="devices")
    telemetry_readings: list["TelemetryReading"] = Relationship(
        back_populates="device", sa_relationship_kwargs={"cascade": "all, delete"}
    )
    daily_summaries: list["DeviceDailySummary"] = Relationship(
        back_populates="device",
        sa_relationship_kwargs={"cascade": "all, delete"}
    )
