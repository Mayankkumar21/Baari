"""Backdate a booking's slot_time for end-to-end testing.

Lets you exercise the no-show sweep / WhatsApp dispatch without waiting 45 minutes.

Example:
    # 1) Create a booking via the UI (gets token T1, id=1)
    # 2) Backdate it 50 minutes:
    python scripts/make_late.py --booking-id 1 --minutes 50
    # 3) Trigger the cron tick:
    curl -X POST http://localhost:8000/api/cron/tick \\
        -H "Authorization: Bearer $(grep CRON_SECRET .env | cut -d= -f2)"
    # 4) Check the queue page — T1 is now no-show; check Neon's `notifications` table
    #    for a row with trigger='no_show'.
"""
from __future__ import annotations

import argparse
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import Session  # noqa: E402

from app.db import engine  # noqa: E402
from app.models import Booking  # noqa: E402
from app.time_utils import now_utc  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--booking-id", type=int, required=True)
    p.add_argument("--minutes", type=int, default=50, help="Minutes in the past to set slot_time")
    args = p.parse_args()

    with Session(engine) as db:
        booking = db.get(Booking, args.booking_id)
        if not booking:
            print(f"No booking with id {args.booking_id}", file=sys.stderr)
            return 1
        new_slot = now_utc() - timedelta(minutes=args.minutes)
        old_slot = booking.slot_time
        booking.slot_time = new_slot
        db.add(booking)
        db.commit()
        print(f"Booking {booking.id} (T{booking.token}, status={booking.status.value})")
        print(f"  slot_time: {old_slot.isoformat()}  →  {new_slot.isoformat()}")
        print("  Now run: curl -X POST http://localhost:8000/api/cron/tick "
              '-H "Authorization: Bearer $(grep CRON_SECRET .env | cut -d= -f2)"')
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
