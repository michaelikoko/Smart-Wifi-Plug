from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime, date as date_type

class TelemetryPayload(BaseModel):
    """This schema matches the JSON published by the ESP32 firmware."""
    ts:        int
    v:         float
    i:         float
    p:         float
    e:         float
    f:         float
    pf:        float
    relay:     int
    rssi:      Optional[int] = None


class TelemetryResponse(BaseModel):
    """
    This schema represents the telemetry data returned by the API endpoints.
    """
    model_config = ConfigDict(from_attributes=True)
    id:          int | None
    device_id:   str
    timestamp:   datetime
    received_at: datetime
    voltage:     float
    current:     float
    power:       float
    energy:      float
    frequency:   float
    pf:          float
    relay:       int
    rssi:        Optional[int]
    created_at:  Optional[datetime]
    updated_at:  Optional[datetime]

class TelemetryListResponse(BaseModel):
    """
    This schema represents the list of telemetry data returned by the API endpoints.
    """
    device_id: str
    count:     int
    readings:  List[TelemetryResponse]


class CurrentEnergyResponse(BaseModel):
    """Today's running consumption — updated on every telemetry message."""
    device_id:    str
    date:         date_type
    energy_first: float          # kWh at start of day (baseline)
    energy_first_timestamp: datetime
    energy_last:  Optional[float]
    energy_last_timestamp: Optional[datetime]
    kwh_consumed: Optional[float]
    peak_power:   Optional[float]
    peak_power_timestamp: Optional[datetime]
    updated_at: Optional[datetime]
    created_at: Optional[datetime]
    estimated_cost: Optional[int] = None # Estimated cost in kobo. This is not stored in the database, but calculated on the fly using the user's billing_rate and the kwh consumed in the current day.


class EnergyConsumedResponse(BaseModel):
    """Energy consumed per day. Used for energy history endpoint."""
    device_id:    str
    date:         date_type
    kwh_consumed: Optional[float]
    peak_power:   Optional[float]
    estimated_cost: Optional[int] = None # Estimated cost in kobo.

class MonthlyEnergyConsumedResponse(BaseModel):
    """Energy consumed for the month."""
    device_id: str
    month: str
    kwh_consumed: float
