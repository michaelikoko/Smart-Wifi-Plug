from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime, date as date_type

class TelemetryPayload(BaseModel):
    """This schema matches the JSON published by the ESP32 firmware."""
    #device_id: str
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
    updated_at: datetime | None
    created_at: datetime | None



class EnergyConsumedResponse(BaseModel):
    """Energy consumed per day. Used for energy history endpoint."""
    device_id:    str
    date:         date_type
    kwh_consumed: Optional[float]
    peak_power:   Optional[float]
    