"""Periodic background jobs dispatched by Vercel Cron via /api/cron/tick.

Designed to be idempotent — running every 5 min is fine even if a previous run already
processed the same booking, because the state filters are tight (only booked/checked_in
get marked no-show, only past slots get marked).
"""
from sqlmodel import Session, select

from app.models import Booking, BookingStatus, Clinic, Patient
from app.services.day_close import close_day, get_summary
from app.services.notifications import notify_no_show
from app.time_utils import clinic_today, now_utc, to_clinic_tz


AUTO_CLOSE_HOUR = 23
AUTO_CLOSE_MIN = 55  # cron runs every 5 min; this is the earliest tick that triggers close


def sweep_no_shows(db: Session, clinic: Clinic) -> int:
    """Mark bookings whose slot is past clinic.no_show_threshold_min as no-show.

    Returns the count of bookings transitioned."""
    today = clinic_today()
    threshold = clinic.no_show_threshold_min or 45
    # naive UTC — matches the TIMESTAMP (without tz) columns in the DB
    cutoff = now_utc().replace(tzinfo=None)

    candidates = db.exec(
        select(Booking).where(
            Booking.clinic_id == clinic.id,
            Booking.date == today,
            Booking.status.in_([BookingStatus.booked, BookingStatus.checked_in]),
        )
    ).all()

    swept = 0
    for b in candidates:
        if (cutoff - b.slot_time).total_seconds() < threshold * 60:
            continue
        b.status = BookingStatus.no_show
        b.no_show_at = cutoff
        b.updated_at = cutoff
        db.add(b)

        patient = db.get(Patient, b.patient_id)
        if patient:
            patient.no_show_count = (patient.no_show_count or 0) + 1
            db.add(patient)
            notify_no_show(db, clinic=clinic, booking=b, patient=patient)
        swept += 1

    return swept


def maybe_auto_close(db: Session, clinic: Clinic) -> bool:
    """Auto-close the day if local time is past 23:55 IST and not already closed."""
    today = clinic_today()
    summary = get_summary(db, clinic.id, today)
    if summary and summary.closed_at:
        return False
    local = to_clinic_tz(now_utc())
    if local.hour < AUTO_CLOSE_HOUR or (local.hour == AUTO_CLOSE_HOUR and local.minute < AUTO_CLOSE_MIN):
        return False
    close_day(db, clinic.id, today)
    return True


def run_tick(db: Session) -> dict[str, int]:
    """Run every-5-min jobs across every clinic. Returns a summary."""
    summary = {"clinics": 0, "no_shows": 0, "auto_closed": 0}
    for clinic in db.exec(select(Clinic)).all():
        summary["clinics"] += 1
        summary["no_shows"] += sweep_no_shows(db, clinic)
        if maybe_auto_close(db, clinic):
            summary["auto_closed"] += 1
    db.commit()
    return summary
