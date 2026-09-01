"""
Removes the backfilled demo rows created by seed_energy_history.py.

Deletes energy_daily rows for the seeded devices, for dates strictly
BEFORE today (i.e. leaves today's real row untouched) and within the
same backfill window used by the seed script.

USAGE:
    DATABASE_URL="postgresql://user:pass@host:port/dbname?sslmode=require" \
    python undo_seed_energy_history.py

Add --dry-run to see what would be deleted without actually deleting it.
"""

import os
import sys
from datetime import datetime, timedelta, timezone

import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("Set DATABASE_URL env var before running this script.")

DAYS_TO_BACKFILL = 40  # must match the value used in seed_energy_history.py

DEVICE_IDS = [
    "esp32-smartplug-4E13F0",
    "esp32-smartplug-4F3130",
]

DRY_RUN = "--dry-run" in sys.argv


def main():
    today = datetime.now(timezone.utc).date()
    window_start = today - timedelta(days=DAYS_TO_BACKFILL)

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT device_id, date, kwh_consumed
                FROM energy_daily
                WHERE device_id = ANY(%s)
                  AND date >= %s
                  AND date < %s
                ORDER BY device_id, date
                """,
                (DEVICE_IDS, window_start, today),
            )
            rows = cur.fetchall()

            print(f"Found {len(rows)} rows to delete (date range {window_start} to {today}, exclusive of today):")
            for device_id, d, kwh in rows:
                print(f"  {device_id}  {d}  {kwh} kWh")

            if DRY_RUN:
                print("\nDry run — nothing deleted. Re-run without --dry-run to apply.")
                return

            if not rows:
                print("Nothing to delete.")
                return

            confirm = input(f"\nDelete these {len(rows)} rows? [y/N] ").strip().lower()
            if confirm != "y":
                print("Aborted — nothing deleted.")
                return

            cur.execute(
                """
                DELETE FROM energy_daily
                WHERE device_id = ANY(%s)
                  AND date >= %s
                  AND date < %s
                """,
                (DEVICE_IDS, window_start, today),
            )
            deleted = cur.rowcount
        conn.commit()
        print(f"Deleted {deleted} rows — committed.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()