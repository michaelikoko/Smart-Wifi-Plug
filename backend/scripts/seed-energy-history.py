"""
Backfills realistic-looking energy_daily rows for the past N days, for demo purposes.

- Skips today (real devices already have today's row).
- Builds energy_first/energy_last as a continuing cumulative meter reading,
  working backwards from each device's current earliest known energy_first.
- Adds natural day-to-day variance + a couple of low/zero-usage days.

USAGE:
    DATABASE_URL="postgresql://user:pass@host:port/dbname?sslmode=require" \
    python seed_energy_history.py

Requires: psycopg2 (pip install psycopg2-binary --break-system-packages)
"""

import os
import random
from datetime import date, datetime, timedelta, timezone

import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("Set DATABASE_URL env var before running this script.")

DAYS_TO_BACKFILL = 40  # covers current + previous month for the month picker

# device_id -> (min_kwh_per_day, max_kwh_per_day, peak_power_watts)
DEVICES = {
    "esp32-smartplug-4E13F0": (0.03, 0.25, 45.0),   # Air Humidifier
    "esp32-smartplug-4F3130": (0.10, 0.60, 120.0),  # Security Lights
}

ZERO_USAGE_CHANCE = 0.08  # ~1 in 12 days with near-zero usage (device unplugged/off)


def build_rows(device_id: str, min_kwh: float, max_kwh: float, peak_power: float):
    """Returns list of (date, energy_first, energy_first_ts, energy_last,
    energy_last_ts, kwh_consumed, peak_power, peak_power_ts) working
    backwards from today, oldest first on return."""
    rows = []
    # Start the cumulative meter reading somewhere reasonable; walk backwards
    # in time, subtracting each day's consumption as we go back.
    running_total = random.uniform(5.0, 15.0)

    today = datetime.now(timezone.utc).date()

    for offset in range(1, DAYS_TO_BACKFILL + 1):
        d = today - timedelta(days=offset)

        if random.random() < ZERO_USAGE_CHANCE:
            day_kwh = round(random.uniform(0.0, 0.01), 4)
        else:
            day_kwh = round(random.uniform(min_kwh, max_kwh), 4)

        energy_last = round(running_total, 4)
        energy_first = round(running_total - day_kwh, 4)
        running_total = energy_first  # walk further back for the next (older) day

        first_ts = datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc) + timedelta(
            minutes=random.randint(0, 15)
        )
        last_ts = datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc) + timedelta(
            hours=random.randint(18, 23), minutes=random.randint(0, 59)
        )
        peak_ts = first_ts + timedelta(hours=random.randint(1, 12))
        this_peak_power = round(peak_power * random.uniform(0.7, 1.15), 2) if day_kwh > 0.01 else 0.0

        rows.append(
            (device_id, d, energy_first, first_ts, energy_last, last_ts, day_kwh, this_peak_power, peak_ts)
        )

    rows.reverse()  # oldest first
    return rows


def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            for device_id, (min_kwh, max_kwh, peak_power) in DEVICES.items():
                rows = build_rows(device_id, min_kwh, max_kwh, peak_power)
                for (
                    dev_id,
                    d,
                    energy_first,
                    first_ts,
                    energy_last,
                    last_ts,
                    kwh_consumed,
                    this_peak_power,
                    peak_ts,
                ) in rows:
                    # No unique constraint exists on (device_id, date) in energy_daily,
                    # so ON CONFLICT isn't usable here — explicitly clear any existing
                    # row(s) for this device+date first, then insert fresh.
                    cur.execute(
                        "DELETE FROM energy_daily WHERE device_id = %s AND date = %s",
                        (dev_id, d),
                    )
                    cur.execute(
                        """
                        INSERT INTO energy_daily
                            (device_id, date, energy_first, energy_first_timestamp,
                             energy_last, energy_last_timestamp, kwh_consumed,
                             peak_power, peak_power_timestamp, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now(), now())
                        """,
                        (
                            dev_id,
                            d,
                            energy_first,
                            first_ts,
                            energy_last,
                            last_ts,
                            kwh_consumed,
                            this_peak_power,
                            peak_ts,
                        ),
                    )
                print(f"Seeded {len(rows)} days for {device_id}")
        conn.commit()
        print("Done — committed.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()