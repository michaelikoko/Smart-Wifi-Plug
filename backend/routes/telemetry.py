from fastapi import APIRouter, Query, HTTPException
from schemas.telemetry import TelemetryListResponse, TelemetryResponse, CurrentEnergyResponse, EnergyConsumedResponse
from datetime import datetime, timezone
from db.session import SessionDep
from sqlmodel import select, desc
from models.telemetry import TelemetryReading, DeviceDailySummary
from auth.dependencies import CurrentActiveUser
from models.device import Device

router = APIRouter(prefix="/telemetry", tags=["telemetry"])

def _to_response(reading: TelemetryReading) -> TelemetryResponse:
    return TelemetryResponse(
        id=reading.id,
        device_id=reading.device_id,
        timestamp=reading.timestamp,
        received_at=reading.received_at,
        voltage=reading.voltage,
        current=reading.current,
        power=reading.power,
        energy=reading.energy,
        frequency=reading.frequency,
        pf=reading.pf,
        relay=reading.relay,
        rssi=reading.rssi,
    )

@router.get("/{device_id}", response_model=TelemetryListResponse,
            summary="Recent telemetry history for a device"
            )
def get_telemetry(
    device_id: str,
    session: SessionDep,
    current_user: CurrentActiveUser,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0)
):
    """Endpoint to get the most recent telemetry data saved in the database"""
    
    # Verify ownership - Change this to a middleware
    device = session.exec(
        select(Device)
        .where(Device.device_id == device_id)
        .where(Device.user_id == current_user.id)
    ).first()
    if not device:
        raise HTTPException(403, "Device not found or access denied")
    
    readings = session.exec(
        select(TelemetryReading)
        .where(TelemetryReading.device_id == device_id)
        .order_by(desc(TelemetryReading.timestamp))
        .limit(limit)
        .offset(offset)
    ).all()

    if not readings:
        raise HTTPException(404, f"No telemetry for device '{device_id}'")

    return TelemetryListResponse(
        device_id = device_id,
        count     = len(readings),
        readings  = [_to_response(r) for r in readings],
    )

@router.get(
    "/{device_id}/energy/today",
    response_model=CurrentEnergyResponse,
    summary="Today's running energy consumption",
)
def get_today_energy(
    device_id: str,
    session: SessionDep,
    current_user: CurrentActiveUser,
):
    """
    Returns today's energy consumption so far.

    kwh_consumed = energy_last - energy_first for today.
    Updated every time a telemetry message is received.
    """
    # Verify ownership - Change this to a middleware
    device = session.exec(
        select(Device)
        .where(Device.device_id == device_id)
        .where(Device.user_id == current_user.id)
    ).first()
    if not device:
        raise HTTPException(403, "Device not found or access denied")
    
    today = datetime.fromtimestamp(datetime.now(timezone.utc).timestamp(), tz=timezone.utc).date()

    summary = session.exec(
        select(DeviceDailySummary)
        .where(DeviceDailySummary.device_id == device_id)
        .where(DeviceDailySummary.date == today)
    ).first()

    if not summary:
        raise HTTPException(404, f"No data for today for device '{device_id}'")

    return CurrentEnergyResponse(
        device_id    = summary.device_id,
        date         = summary.date,
        energy_first = summary.energy_first,
        energy_first_timestamp = summary.energy_first_timestamp,
        energy_last  = summary.energy_last,
        energy_last_timestamp = summary.energy_last_timestamp,
        kwh_consumed = summary.kwh_consumed,
        peak_power   = summary.peak_power,
        peak_power_timestamp = summary.peak_power_timestamp,
        updated_at = summary.updated_at,
        created_at = summary.created_at
    )

@router.get(
    "/{device_id}/energy/history",
    response_model=list[EnergyConsumedResponse],
    summary="Daily energy consumption for the past N days",
)
def get_energy_history(
    device_id: str,
    session: SessionDep,
    current_user: CurrentActiveUser,
    days: int = Query(default=7, le=90),
):
    """
    Returns one row per day showing kWh consumed.
    Useful for the 7-day bar chart in the mobile app dashboard.
    """
    # Verify ownership - Change this to a middleware
    device = session.exec(
        select(Device)
        .where(Device.device_id == device_id)
        .where(Device.user_id == current_user.id)
    ).first()
    if not device:
        raise HTTPException(403, "Device not found or access denied")
    
    summaries = session.exec(
        select(DeviceDailySummary)
        .where(DeviceDailySummary.device_id == device_id)
        .order_by(desc(DeviceDailySummary.date))
        .limit(days)
    ).all()

    if not summaries:
        raise HTTPException(404, f"No energy history for device '{device_id}'")

    return [
        EnergyConsumedResponse(
            device_id    = s.device_id,
            date         = s.date,
            kwh_consumed = s.kwh_consumed,
            peak_power   = s.peak_power,
        )
        for s in summaries
    ]

