from typing import Optional, ClassVar, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from datetime import date as date_type

if TYPE_CHECKING:
    from models.device import Device


class DeviceTimer(SQLModel, table=True):
    """
    A single ON/OFF schedule entry for a device. Multiple timers can
    exist per device. Recurs every day at `time` (no day-of-week
    selection). `action` is a plain str ("ON"/"OFF") validated at the
    schema layer — kept simple rather than a DB-level enum type.
    """

    __tablename__: ClassVar[str] = "device_timers"

    id: Optional[int] = Field(default=None, primary_key=True)
    device_id: str = Field(foreign_key="devices.device_id", index=True)
    name: Optional[str] = Field(default=None, max_length=100)
    time: str = Field(max_length=5)  # 24-hour "HH:MM", zero-padded
    action: str = Field(max_length=3)  # "ON" or "OFF"
    is_enabled: bool = Field(default=True, nullable=False)
    # Dedupe guard — prevents the sweep from re-firing the same timer
    # repeatedly all day once its trigger time has passed. Cleared
    # naturally at day rollover (compared against today's date, not
    # stored as a boolean).
    last_triggered_date: Optional[date_type] = Field(default=None)

    device: "Device" = Relationship(back_populates="timers")
