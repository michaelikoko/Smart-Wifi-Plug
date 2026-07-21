from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from models.device import Device
from models.energy_event import EnergyEvent, EnergyEventPeriod, EnergyEventType

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger("energy_limits.enforcement")


def _try_create_event(
    session: Session,
    device_id: str,
    user_id: int,
    event_type: EnergyEventType,
    period: EnergyEventPeriod,
    period_key: str,
    kwh_at_event: float,
    limit_kwh: float,
) -> EnergyEvent | None:
    nested_transaction = session.begin_nested()
    try:
        event = EnergyEvent(
            device_id=device_id,
            user_id=user_id,
            event_type=event_type,
            period=period,
            period_key=period_key,
            kwh_at_event=kwh_at_event,
            limit_kwh=limit_kwh,
        )
        session.add(event)
        session.flush()
        nested_transaction.commit()
        # logger.info("Event created — device=%s type=%s period=%s", device_id, event_type, period_key)
        return event
    except IntegrityError as e:
        # logger.error("IntegrityError in _try_create_event — device=%s type=%s: %s", device_id, event_type, e)
        nested_transaction.rollback()
        return None


def check_limits_and_get_cutoff_reason(
    device: Device,
    daily_kwh: float,
    monthly_kwh: float,
    session: Session,
) -> tuple[str | None, list[EnergyEvent]]:
    events: list[EnergyEvent] = []
    cutoff_reason: str | None = None

    now = datetime.now(timezone.utc)
    today_key = now.date().isoformat()
    month_key = now.strftime("%Y-%m")

    if device.user_id is None:
        return None, []

    logger.info(
        "Enforcement check — device=%s daily=%.3f monthly=%.3f daily_limit=%s monthly_limit=%s",
        device.device_id,
        daily_kwh,
        monthly_kwh,
        device.daily_limit_kwh,
        device.monthly_limit_kwh,
    )
    if device.daily_limit_kwh is not None and daily_kwh > device.daily_limit_kwh:
        cutoff_reason = cutoff_reason or "daily_limit"
        event = _try_create_event(
            session=session,
            device_id=device.device_id,
            user_id=device.user_id,
            event_type=EnergyEventType.DAILY_LIMIT_REACHED,
            period=EnergyEventPeriod.DAILY,
            period_key=today_key,
            kwh_at_event=daily_kwh,
            limit_kwh=device.daily_limit_kwh,
        )
        if event is not None:
            events.append(event)

    if device.monthly_limit_kwh is not None and monthly_kwh > device.monthly_limit_kwh:
        cutoff_reason = cutoff_reason or "monthly_limit"
        event = _try_create_event(
            session=session,
            device_id=device.device_id,
            user_id=device.user_id,
            event_type=EnergyEventType.MONTHLY_LIMIT_REACHED,
            period=EnergyEventPeriod.MONTHLY,
            period_key=month_key,
            kwh_at_event=monthly_kwh,
            limit_kwh=device.monthly_limit_kwh,
        )
        if event is not None:
            events.append(event)

    return cutoff_reason, events
