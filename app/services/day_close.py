from collections import Counter
from datetime import date, datetime

from sqlmodel import Session, select

from app.models import Booking, BookingStatus, DailySummary, Patient
from app.time_utils import clinic_today, now_utc, to_clinic_tz


class DayCloseError(ValueError):
    """Tried to close a day that's already closed, or another invariant violation."""


def get_summary(db: Session, clinic_id: int, on: date) -> DailySummary | None:
    return db.exec(
        select(DailySummary).where(
            DailySummary.clinic_id == clinic_id, DailySummary.date == on
        )
    ).first()


def compute_summary(db: Session, clinic_id: int, on: date) -> DailySummary:
    bookings = db.exec(
        select(Booking).where(Booking.clinic_id == clinic_id, Booking.date == on)
    ).all()

    completed = [b for b in bookings if b.status == BookingStatus.done]
    no_shows = sum(1 for b in bookings if b.status == BookingStatus.no_show)
    cancellations = sum(1 for b in bookings if b.status == BookingStatus.cancelled)

    waits: list[int] = []
    consults: list[int] = []
    started_times: list[datetime] = []
    completed_times: list[datetime] = []

    for b in completed:
        if b.checked_in_at and b.started_at:
            waits.append(int((b.started_at - b.checked_in_at).total_seconds()))
        if b.started_at and b.completed_at:
            consults.append(int((b.completed_at - b.started_at).total_seconds()))
            started_times.append(b.started_at)
            completed_times.append(b.completed_at)

    avg_wait = int(sum(waits) / len(waits)) if waits else None
    avg_consult = int(sum(consults) / len(consults)) if consults else None

    if started_times:
        # Peak hour in clinic local time
        hours = Counter(to_clinic_tz(t).hour for t in started_times)
        peak_hour = hours.most_common(1)[0][0]
    else:
        peak_hour = None

    summary = get_summary(db, clinic_id, on)
    if summary is None:
        summary = DailySummary(clinic_id=clinic_id, date=on)
    summary.total_bookings = len(bookings)
    summary.completed = len(completed)
    summary.no_shows = no_shows
    summary.cancellations = cancellations
    summary.avg_wait_seconds = avg_wait
    summary.avg_consult_seconds = avg_consult
    summary.peak_hour = peak_hour
    summary.first_consult_at = min(started_times) if started_times else None
    summary.last_consult_at = max(completed_times) if completed_times else None
    summary.generated_at = now_utc()
    return summary


def close_day(db: Session, clinic_id: int, on: date | None = None) -> DailySummary:
    """Idempotent: re-running on a closed day refreshes the summary stats but
    won't sweep additional patients (none are eligible by then)."""
    on = on or clinic_today()
    cutoff = now_utc()

    # Sweep any still-active bookings to no_show
    candidates = db.exec(
        select(Booking).where(
            Booking.clinic_id == clinic_id,
            Booking.date == on,
            Booking.status.in_([BookingStatus.booked, BookingStatus.checked_in, BookingStatus.in_consult]),
        )
    ).all()
    for b in candidates:
        if b.status == BookingStatus.in_consult:
            # Treat an unfinished in-consult booking as completed for the books
            b.status = BookingStatus.done
            b.completed_at = cutoff
        else:
            b.status = BookingStatus.no_show
            b.no_show_at = cutoff
            patient = db.get(Patient, b.patient_id)
            if patient:
                patient.no_show_count = (patient.no_show_count or 0) + 1
                db.add(patient)
        b.updated_at = cutoff
        db.add(b)

    summary = compute_summary(db, clinic_id, on)
    summary.closed_at = summary.closed_at or cutoff
    db.add(summary)
    db.flush()
    return summary
