from fastapi_mqtt import FastMQTT, MQTTConfig
from gmqtt import Client as MQTTClient
from typing import Any
import logging
from datetime import datetime, timezone, date as date_type
from zoneinfo import ZoneInfo
from schemas.telemetry import TelemetryPayload, CurrentEnergyResponse, MonthlyEnergyConsumedResponse
from db.session import SessionDep, engine
from models.telemetry import TelemetryReading, DeviceDailySummary
from sqlmodel import select, Session, col
from energy_limits.enforcement import check_limits_and_get_cutoff_reason
from models.energy_event import EnergyEvent
from models.device_timer import DeviceTimer
import json
from models.device import Device
import re
import asyncio
import os

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger("mqtt")

mqtt_config = MQTTConfig(
    host=os.environ["MQTT_HOST"],
    port=int(os.getenv("MQTT_PORT", "8883")),
    ssl=True,
    keepalive = 30,
    username=os.environ["MQTT_USERNAME"],
    password=os.environ["MQTT_PASSWORD"],
)
fast_mqtt = FastMQTT(config=mqtt_config)

_MIN_VALID_TS = 1735689600  # Jan 1, 2026 in epoch seconds

# Mirrors firmware's TELEMETRY_INTERVAL_MS. A device is considered stale (and marked offline) if last_seen is older than this.
TELEMETRY_INTERVAL_S = 10
STALENESS_THRESHOLD_S = TELEMETRY_INTERVAL_S * 2  
STALENESS_SWEEP_INTERVAL_S = 15                     
LAGOS_TZ = ZoneInfo("Africa/Lagos")
TIMER_SWEEP_INTERVAL_S = 10

DEVICE_TOPIC_RE = re.compile(r"^smartplug/([^/]+)/")


def _extract_device_id(topic: str) -> str | None:
    """
    Extract the device_id from the topic.
    """
    match = DEVICE_TOPIC_RE.match(topic)
    if not match:
        logger.error("Invalid topic format: %s", topic)
        return None

    return match.group(1)


def _resolve_timestamp(ts: int) -> int:
    backend_ts = int(datetime.now(timezone.utc).timestamp())
    drift_seconds = abs(ts - backend_ts)

    # Reject if more than 10 minutes drift from backend time
    if ts < _MIN_VALID_TS or drift_seconds > 600:
        logger.warning(
            "Device ts=%d drifts %.0fs from backend ts=%d — using backend ts",
            ts,
            drift_seconds,
            backend_ts,
        )
        return backend_ts

    return ts

def _publish_online_status(device_id: str, is_online: bool):
    """Helper to broadcast definitive online status to mobile clients."""
    logger.info("Publishing online status — device=%s is_online=%s", device_id, is_online)
    topic = f"smartplug/{device_id}/be-online-status"
    payload = json.dumps({"is_online": is_online})
    fast_mqtt.publish(topic, payload, qos=1, retain=True)


def _publish_timer_lock(
    device_id: str, locked: bool, reason: str | None, locked_at: datetime | None
):
    """Helper to broadcast timer-lock state to mobile clients (retained, push-on-transition, same pattern as _publish_online_status)."""
    topic = f"smartplug/{device_id}/be-timer-lock"
    payload = json.dumps({
        "locked": locked,
        "reason": reason,
        "locked_at": locked_at.isoformat() if locked_at else None,
    })
    fast_mqtt.publish(topic, payload, qos=1, retain=True)
    logger.info("Published timer lock — device=%s locked=%s", device_id, locked)


def _publish_daily_summary(device_id: str, summary: DeviceDailySummary, billing_rate: int | None):
    """Helper to broadcast the full CurrentEnergyResponse to mobile clients."""
    logger.info("Publishing daily summary — device=%s date=%s", device_id, summary.date)
    estimated_cost = None
    if billing_rate is not None and summary.kwh_consumed is not None:
        estimated_cost = int(summary.kwh_consumed * billing_rate)

    # Build the full Pydantic model
    response = CurrentEnergyResponse(
        device_id=summary.device_id,
        date=summary.date,
        energy_first=summary.energy_first,
        energy_first_timestamp=summary.energy_first_timestamp,
        energy_last=summary.energy_last,
        energy_last_timestamp=summary.energy_last_timestamp,
        kwh_consumed=summary.kwh_consumed,
        peak_power=summary.peak_power,
        peak_power_timestamp=summary.peak_power_timestamp,
        updated_at=summary.updated_at,
        created_at=summary.created_at,
        estimated_cost=estimated_cost
    )

    topic = f"smartplug/{device_id}/be-daily-summary"
    
    # model_dump_json() magically handles datetime serialization!
    payload = response.model_dump_json() 
    
    fast_mqtt.publish(topic, payload, qos=1, retain=True)

def _publish_monthly_summary(device_id: str, session: Session, billing_rate: int | None):
    """Helper to broadcast the current month's total energy consumption to mobile clients."""
    logger.info("Publishing monthly summary — device=%s", device_id)
    
    now = datetime.now(timezone.utc)
    month_start = date_type(now.year, now.month, 1)

    summaries = session.exec(
        select(DeviceDailySummary)
        .where(DeviceDailySummary.device_id == device_id)
        .where(DeviceDailySummary.date >= month_start)
    ).all()

    monthly_kwh = round(sum(s.kwh_consumed or 0.0 for s in summaries), 4)
    
    estimated_cost = None
    if billing_rate is not None:
        estimated_cost = int(monthly_kwh * billing_rate)

    response = MonthlyEnergyConsumedResponse(
        device_id=device_id,
        month=now.strftime("%Y-%m"),
        kwh_consumed=monthly_kwh,
        estimated_cost=estimated_cost
    )

    topic = f"smartplug/{device_id}/be-monthly-summary"
    payload = response.model_dump_json()
    
    fast_mqtt.publish(topic, payload, qos=1, retain=True)

# Helper: publish relay command
def _publish_relay_command(device_id: str, state: bool):
    """Publish a backend-initiated relay command (e.g. auto-cutoff)."""
    topic = f"smartplug/{device_id}/relay/command"
    payload = json.dumps({"cmd": "ON" if state else "OFF"})
    fast_mqtt.publish(topic, payload, qos=1, retain=False)
    logger.info("Relay command published — device=%s state=%s", device_id, state)


def _publish_energy_event(device_id: str, event: EnergyEvent):
    """Publish a newly created energy limit breach event to the mobile client."""
    topic = f"smartplug/{device_id}/energy-event"
    payload = json.dumps({
        "id": event.id,
        "event_type": event.event_type.value,
        "period": event.period.value,
        "period_key": event.period_key,
        "kwh_at_event": event.kwh_at_event,
        "limit_kwh": event.limit_kwh,
        "created_at": event.created_at.isoformat() if event.created_at else None,
    })
    fast_mqtt.publish(topic, payload, qos=1, retain=False)
    logger.info("Energy event published — device=%s type=%s", device_id, event.event_type.value)

def _get_date(ts_epoch: int) -> date_type:
    """
    Convert the given epoch timestamp to a date in UTC.
    """
    return datetime.fromtimestamp(ts_epoch, tz=timezone.utc).date()


def _save_telemetry_to_db(
    payload: TelemetryPayload, device_id: str, session: SessionDep
):
    """
    Resolves the timestamp from the payload.
    Saves the telemetry data to the database.
    Update the daily energy consumption for the device.
    """
    try:
        device = session.exec(
            select(Device)
            .where(Device.device_id == device_id)
            .where(Device.is_enabled == True)  # noqa: E712
        ).first()

        if not device or device.user is None:
            # Device not registered in the database, log a warning and return
            logger.warning("Telemetry received for unregistered or disabled device: %s", device_id)
            return

        resolved_ts_epoch = _resolve_timestamp(payload.ts)
        date = _get_date(resolved_ts_epoch)

        telemetry_reading = TelemetryReading(
            device_id=device_id,
            timestamp=datetime.fromtimestamp(resolved_ts_epoch, tz=timezone.utc),
            voltage=payload.v,
            current=payload.i,
            power=payload.p,
            energy=payload.e,
            frequency=payload.f,
            pf=payload.pf,
            relay=payload.relay,
            rssi=payload.rssi,
        )

        session.add(telemetry_reading)  # Save the telemetry reading to the database
        current_summary = session.exec(
            select(DeviceDailySummary)
            .where(DeviceDailySummary.device_id == device_id)
            .where(DeviceDailySummary.date == date)
        ).first()

        if current_summary is None:
            # Create the first summary of the day
            current_summary = DeviceDailySummary(
                device_id=device_id,
                date=date,
                energy_first=payload.e,
                energy_first_timestamp=datetime.fromtimestamp(
                    resolved_ts_epoch, tz=timezone.utc
                ),
                energy_last=payload.e,
                energy_last_timestamp=datetime.fromtimestamp(
                    resolved_ts_epoch, tz=timezone.utc
                ),
                kwh_consumed=0.0,
                peak_power=payload.p,
                peak_power_timestamp=datetime.fromtimestamp(
                    resolved_ts_epoch, tz=timezone.utc
                ),
            )
            session.add(current_summary)
            logger.info(
                "Day baseline set — device=%s date=%s energy_first=%.3f kWh",
                device_id,
                date,
                payload.e,
            )
        else:
            # Update existing summary
            current_summary.energy_last = payload.e
            current_summary.energy_last_timestamp = datetime.fromtimestamp(
                resolved_ts_epoch, tz=timezone.utc
            )
            current_summary.kwh_consumed = round(
                current_summary.energy_last - current_summary.energy_first, 4
            )

            if payload.p > (current_summary.peak_power or 0):
                current_summary.peak_power = payload.p
                current_summary.peak_power_timestamp = datetime.fromtimestamp(
                    resolved_ts_epoch, tz=timezone.utc
                )

        logger.info(
            "Saved — device=%s date=%s V=%.1f P=%.1fW "
            "energy=%.3f kWh consumed_today=%.3f kWh",
            device_id,
            date,
            payload.v,
            payload.p,
            payload.e,
            current_summary.kwh_consumed or 0.0,
        )

        # Update last_seen and relay_state on the device record, and online status
        device.last_seen = datetime.fromtimestamp(resolved_ts_epoch, tz=timezone.utc)
        if not device.cutoff_reason:
            # Only update relay state if device is not cut off.
            device.relay_state = bool(payload.relay)  # ← Update relay state
        device.is_online = True  # Device is online if we're receiving telemetry
        session.add(device)

        # Broadcast the online status to mobile clients - Maybe on publish on transition to avoid spamming
        _publish_online_status(device_id, True)

        # Publish daily summary to mobile clients
        _publish_daily_summary(device_id, current_summary, device.user.billing_rate)

        # Publish monthly summary to mobile clients
        _publish_monthly_summary(device_id, session, device.user.billing_rate)

        logger.info(
            "Updated device — device=%s last_seen=%s relay=%s",
            device_id,
            device.last_seen,
            device.relay_state,
        )

        # Energy limit enforcement
        if device.auto_cutoff_enabled:
            daily_kwh = current_summary.kwh_consumed or 0.0

            # Compute monthly usage: sum kwh_consumed across all daily summaries this month
            now_utc = datetime.now(timezone.utc)
            month_start = date_type(now_utc.year, now_utc.month, 1)
            monthly_rows = session.exec(
                select(DeviceDailySummary)
                .where(DeviceDailySummary.device_id == device_id)
                .where(DeviceDailySummary.date >= month_start)
            ).all()
            monthly_kwh = sum(r.kwh_consumed or 0.0 for r in monthly_rows)

            cutoff_reason, new_events = check_limits_and_get_cutoff_reason(
                device=device,
                daily_kwh=daily_kwh,
                monthly_kwh=monthly_kwh,
                session=session,
            )

            if cutoff_reason and not device.cutoff_reason:
                # First breach — cut off the device
                device.cutoff_reason = cutoff_reason
                device.cutoff_at = datetime.now(timezone.utc)
                device.relay_state = False
                session.add(device)
                _publish_relay_command(device_id, False)
                logger.warning(
                    "Auto-cutoff triggered — device=%s reason=%s daily=%.3f monthly=%.3f",
                    device_id, cutoff_reason, daily_kwh, monthly_kwh,
                )

            session.commit()

            print("Checking events to publish")
            print(new_events)
            for event in new_events:
                session.refresh(event)  # Refresh to get the auto-generated ID and timestamps
                print("Publishing events")
                _publish_energy_event(device_id, event)
        else:
            session.commit() # commits when auto_cutoff_enabled is False
        # --- End energy limit enforcement ---

    except Exception as e:
        logger.error("Error saving telemetry to DB: %s", e)
        session.rollback()
        raise


def register_mqtt_handlers():
    @fast_mqtt.on_connect()
    def on_connect(client: MQTTClient, flags: int, rc: int, properties: Any):
        logger.info("MQTT broker connected — rc=%d", rc)

    @fast_mqtt.subscribe("smartplug/+/telemetry", qos=0)
    async def on_telemetry(
        client: MQTTClient,
        topic: str,
        payload: bytes,
        qos: int,
        properties: Any,
    ):
        logger.info("Telemetry on topic: %s", topic)
        device_id = _extract_device_id(topic)

        if not device_id:
            logger.error("Failed to extract device_id from topic: %s", topic)
            return

        try:
            data = json.loads(payload.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.error("JSON decode error: %s", e)
            return

        try:
            telemetry = TelemetryPayload(**data)
        except Exception as e:
            logger.error("Payload validation error: %s", e)
            return

        try:
            # session = next(get_session())
            with Session(engine) as session:
                _save_telemetry_to_db(telemetry, device_id, session)
        except Exception as e:
            logger.error("Database write error: %s", e)

    @fast_mqtt.subscribe("smartplug/+/status", qos=1)
    async def on_status(
        client: MQTTClient,
        topic: str,
        payload: bytes,
        qos: int,
        properties: Any,
    ):
        logger.info("Status — topic=%s payload=%s", topic, payload.decode())
        device_id = _extract_device_id(topic)
        if not device_id:
            logger.error("Failed to extract device_id from topic: %s", topic)
            return
        
        try:
            data = json.loads(payload.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.error("Status JSON decode error: %s", e)
            return
        
        status = data.get("status")
        if status is None:
            logger.error("Missing 'status' field in status payload")
            return
        
        if status == "offline":
            is_online = False
        elif status == "online":
            is_online = True
        else:
            logger.error("Invalid 'status' value in payload: %s", status)
            return

        try:
            with Session(engine) as session:
                device = session.exec(
                    select(Device)
                    .where(Device.device_id == device_id)
                    .where(Device.is_enabled == True)  # noqa: E712
                ).first()
                if device:
                    device.is_online = is_online
                    if is_online:
                        device.last_seen = datetime.now(timezone.utc)
                    session.add(device)
                    session.commit()

                    # Broadcast the online status to mobile clients
                    _publish_online_status(device_id, is_online)
                    logger.info(
                        "Device status updated — device=%s is_online=%s", device_id, is_online
                    )
                else:
                    logger.warning(
                        "Status received for unregistered or disabled device: %s", device_id
                    )
        except Exception as e:
            logger.error("Failed to update device status: %s", e)

    @fast_mqtt.subscribe("smartplug/+/relay/state", qos=1)
    async def on_relay_state(
        client: MQTTClient,
        topic: str,
        payload: bytes,
        qos: int,
        properties: Any,
    ):
        logger.info("Relay state — topic=%s payload=%s", topic, payload.decode())
        device_id = _extract_device_id(topic)
        if not device_id:
            logger.error("Failed to extract device_id from topic: %s", topic)
            return

        try:
            data = json.loads(payload.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.error("Relay state JSON decode error: %s", e)
            return

        state = data.get("state")
        if state is None:
            logger.error("Missing 'state' field in relay state payload")
            return

        try:
            with Session(engine) as session:
                device = session.exec(
                    select(Device)
                    .where(Device.device_id == device_id)
                    .where(Device.is_enabled == True)  # noqa: E712
                ).first()
                if device:
                    device.relay_state = state == "ON"
                    device.is_online = (
                        True  # Device is online if we're receiving relay state updates
                    )
                    device.last_seen = datetime.now(timezone.utc)
                    session.add(device)
                    session.commit()

                    # Broadcast the online status to mobile clients
                    _publish_online_status(device_id, True)
                    logger.info(
                        "Relay state updated — device=%s state=%s", device_id, state
                    )
                else:
                    logger.warning(
                        "Relay state received for unregistered or disabled device: %s", device_id
                    )
        except Exception as e:
            logger.error("Failed to update relay state: %s", e)

    @fast_mqtt.on_disconnect()
    def on_disconnect(client: MQTTClient, packet, exc=None):
        logger.warning("MQTT disconnected — %s", exc)


async def start_timer_sweep():
    """
    Second scheduler loop, structurally identical to start_staleness_sweep().
    Every TIMER_SWEEP_INTERVAL_S, checks enabled timers against the current
    Africa/Lagos local time. A timer "fires" once per day, the first sweep
    after its trigger time has passed (self-healing if the server was down
    at the exact minute — it fires late on the next sweep rather than never,
    as long as the day hasn't rolled over).

    Fire-and-forget: publishes the relay command the same way auto-cutoff
    does (_publish_relay_command) with no delivery confirmation awaited.
    """
    logger.info(
        "Starting timer sweep — interval=%ds, tz=Africa/Lagos", TIMER_SWEEP_INTERVAL_S
    )
    while True:
        await asyncio.sleep(TIMER_SWEEP_INTERVAL_S)
        try:
            now_local = datetime.now(LAGOS_TZ)
            now_hhmm = now_local.strftime("%H:%M")
            today_local = now_local.date()

            with Session(engine) as session:
                due_timers = session.exec(
                    select(DeviceTimer)
                    .where(DeviceTimer.is_enabled == True)  # noqa: E712
                    .where(DeviceTimer.time <= now_hhmm)
                    .where(
                        (col(DeviceTimer.last_triggered_date) == None)  # noqa: E711
                        | (col(DeviceTimer.last_triggered_date) != today_local)
                    )
                ).all()

                if not due_timers:
                    continue

                for timer in due_timers:
                    device = session.exec(
                        select(Device)
                        .where(Device.device_id == timer.device_id)
                        .where(Device.is_enabled == True)  # noqa: E712
                    ).first()

                    if not device:
                        # Orphaned timer (device soft-deleted/unclaimed) — mark
                        # as handled today so it doesn't retry every sweep.
                        timer.last_triggered_date = today_local
                        session.add(timer)
                        session.commit()
                        continue

                    relay_on = timer.action == "ON"
                    label = timer.name or f"Timer ({timer.time})"

                    if relay_on and device.cutoff_reason:
                        # Device is currently cut off for exceeding an energy
                        # limit — an ON timer must not override that. Leave
                        # last_triggered_date untouched so this timer stays
                        # "due" and is retried on the next sweep, firing as
                        # soon as the cutoff clears (or naturally rolling
                        # over to tomorrow if it never does).
                        logger.info(
                            "Timer skipped — device=%s name=%s blocked by active cutoff (%s)",
                            timer.device_id, label, device.cutoff_reason,
                        )
                        continue

                    _publish_relay_command(timer.device_id, relay_on)

                    reason = f"Turned {'ON' if relay_on else 'OFF'} by '{label}' at {timer.time}"
                    now_utc = datetime.now(timezone.utc)

                    device.timer_lock_reason = reason
                    device.timer_locked_at = now_utc
                    device.relay_state = relay_on
                    timer.last_triggered_date = today_local

                    session.add(device)
                    session.add(timer)
                    session.commit()

                    _publish_timer_lock(timer.device_id, True, reason, now_utc)

                    logger.info(
                        "Timer fired — device=%s action=%s name=%s",
                        timer.device_id, timer.action, label,
                    )

        except Exception as e:
            logger.error("Timer sweep error: %s", e)


async def start_staleness_sweep():
    """
    The staleness sweep is the second line of defense beyond LWT: if a device's last_seen is older than STALENESS_THRESHOLD_S, mark it offline even if no offline status message was ever received (e.g. broker silently drops the connection without delivering the will message. This is rare but possible on a shared public broker).
    """
    logger.info(
        "Starting staleness sweep — threshold=%.1fs, interval=%ds",
        STALENESS_THRESHOLD_S,
        STALENESS_SWEEP_INTERVAL_S,
    )
    while True:
        await asyncio.sleep(STALENESS_SWEEP_INTERVAL_S)
        try:
            cutoff = datetime.now(timezone.utc).timestamp() - STALENESS_THRESHOLD_S
            cutoff_dt = datetime.fromtimestamp(cutoff, tz=timezone.utc)

            with Session(engine) as session:
                stale_devices = session.exec(
                    select(Device)
                    .where(Device.is_online == True)  # noqa: E712
                    .where(Device.is_enabled == True)  # noqa: E712
                    .where(
                        (col(Device.last_seen) == None)  # noqa: E711
                        | (col(Device.last_seen) < cutoff_dt)
                    )
                ).all()

                if not stale_devices:
                    logger.info("No stale devices found in this sweep")
                    continue

                for device in stale_devices:
                    device.is_online = False
                    session.add(device)

                    # Broadcast the online status to mobile clients
                    _publish_online_status(device.device_id, False)
                    logger.info(
                        "Marking device offline (stale) — device=%s last_seen=%s",
                        device.device_id,
                        device.last_seen,
                    )

                if stale_devices:
                    session.commit()

        except Exception as e:
            logger.error("Staleness sweep error: %s", e)
