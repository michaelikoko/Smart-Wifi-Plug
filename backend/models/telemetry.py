from sqlmodel import SQLModel, Field, Column, DateTime, func, Relationship
from typing import Optional, ClassVar, TYPE_CHECKING
from datetime import datetime, timezone,  date as date_type

if TYPE_CHECKING:
    from models.device import Device

class TelemetryReading(SQLModel, table=True):
    """
    One row per reading received from the MQTT telemetry topic.

    ts          — Unix epoch timestamp from the ESP32
    received_at — When the backend received the MQTT message
    energy      — PZEM accumulated energy counter (kWh). It can't be reset programmatically.
                  Energy consumed in any period = e_end - e_start.
    """

    __tablename__: ClassVar[str] = "telemetry"

    id: Optional[int] = Field(default=None, primary_key=True)
    device_id: str = Field(
        foreign_key="devices.device_id",
        index=True
    )
    timestamp: datetime = Field(index=True)  # ESP32 timestamp converted to datetime in UTC
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    voltage: float  # V
    current: float  # A
    power: float  # W  — instantaneous active power
    energy: float  # kWh — accumulated total, never resets
    frequency: float  # Hz
    pf: float  # power factor
    relay: int  # 1 = ON, 0 = OFF
    rssi: Optional[int] = None
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(
            # pylint: disable=not-callable
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=True
        )
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(
            # pylint: disable=not-callable
            DateTime(timezone=True),
            onupdate=func.now(),
            server_default=func.now(),
            nullable=True
        )
    )
    device: Optional["Device"] = Relationship(back_populates="telemetry_readings")


class DeviceDailySummary(SQLModel, table=True):
    """
    One row per device per day.

    Stores the first and last energy readings of the day so that
    consumed energy(kWh) can be computed without scanning the full telemetry table.

    kwh_consumed = energy_last - energy_first
    This is computed on every new reading and stored for fast retrieval.
    """
    __tablename__: ClassVar[str] = "energy_daily"

    id: Optional[int] = Field(default=None, primary_key=True)
    device_id: str = Field(foreign_key="devices.device_id", index=True)
    date: date_type = Field(index=True)  # "YYYY-MM-DD" in UTC

    # First reading of the day — set once, never updated
    energy_first: float  # kWh at start of day
    energy_first_timestamp: datetime  # ESP32 timestamp of first reading

    # Last reading of the day — updated on every new reading
    energy_last: Optional[float] = None  # kWh at latest reading
    energy_last_timestamp: Optional[datetime] = None  # ESP32 timestamp of latest reading

    # Derived — updated on every new reading
    kwh_consumed: Optional[float] = None  # energy_last - energy_first
    peak_power: Optional[float] = None  # max instantaneous power today
    peak_power_timestamp: Optional[datetime] = None  # ESP32 timestamp of peak power reading

    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(
            # pylint: disable=not-callable
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=True
        )
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(
            # pylint: disable=not-callable
            DateTime(timezone=True),
            onupdate=func.now(),
            server_default=func.now(),
            nullable=True
        )
    )
    device: Optional["Device"] = Relationship(back_populates="daily_summaries")
