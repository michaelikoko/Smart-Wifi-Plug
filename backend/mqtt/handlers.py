from fastapi_mqtt import FastMQTT, MQTTConfig
from gmqtt import Client as MQTTClient
from typing import Any
import logging
from datetime import datetime, timezone, date as date_type
from schemas.telemetry import TelemetryPayload
from db.session import SessionDep, get_session, engine
from models.telemetry import TelemetryReading, DeviceDailySummary
from sqlmodel import select, Session, col
import json
from models.device import Device
import re
import asyncio

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger("mqtt")

mqtt_config = MQTTConfig(
    host="broker.hivemq.com",
    port=1883,
)
fast_mqtt = FastMQTT(config=mqtt_config)

_MIN_VALID_TS = 1735689600  # Jan 1, 2026 in epoch seconds

# Mirrors firmware's TELEMETRY_INTERVAL_MS. A device is considered stale (and marked offline) if last_seen is older than this.
TELEMETRY_INTERVAL_S = 10
STALENESS_THRESHOLD_S = TELEMETRY_INTERVAL_S * 3
STALENESS_SWEEP_INTERVAL_S = 60

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


# def _resolve_timestamp(ts: int) -> int:
#    """
#    Use the ESP32 timestamp if it looks valid (i.e. after Jan 1, 2026), otherwise use the current backend timestamp.
#    """
#    if ts >= _MIN_VALID_TS:
#        return ts
#    backend_ts = int(datetime.now(timezone.utc).timestamp())
#    logger.warning(
#    "Received invalid timestamp %s from device, using backend timestamp %s instead", ts,
#    backend_ts,
#    )
#    return backend_ts


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

        if not device:
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
        device.relay_state = bool(payload.relay)  # ← Update relay state
        device.is_online = True  # Device is online if we're receiving telemetry
        session.add(device)
        logger.info(
            "Updated device — device=%s last_seen=%s relay=%s",
            device_id,
            device.last_seen,
            device.relay_state,
        )

        session.commit()
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
                    logger.info(
                        "Marking device offline (stale) — device=%s last_seen=%s",
                        device.device_id,
                        device.last_seen,
                    )

                if stale_devices:
                    session.commit()

        except Exception as e:
            logger.error("Staleness sweep error: %s", e)
