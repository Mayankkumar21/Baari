from collections import Counter
from dataclasses import dataclass
from datetime import date, timedelta

from sqlmodel import Session, select

from app.models import Booking, BookingStatus, DailySummary, Patient
from app.time_utils import to_clinic_tz


@dataclass
class DayCard:
    summary: DailySummary
    completion_pct: int  # 0–100


@dataclass
class HourBin:
    hour: int            # 0–23 clinic-local
    consults: int


@dataclass
class TimelineRow:
    booking: Booking
    patient: Patient


@dataclass
class DayDetailVM:
    summary: DailySummary
    hourly: list[HourBin]
    timeline: list[TimelineRow]
    peak_count: int


def list_recent_days(db: Session, clinic_id: int, limit: int = 30) -> list[DayCard]:
    rows = db.exec(
        select(DailySummary)
        .where(DailySummary.clinic_id == clinic_id)
        .order_by(DailySummary.date.desc())
        .limit(limit)
    ).all()
    return [
        DayCard(
            summary=s,
            completion_pct=(
                int(100 * s.completed / s.total_bookings) if s.total_bookings else 0
            ),
        )
        for s in rows
    ]


def day_detail(db: Session, clinic_id: int, on: date) -> DayDetailVM | None:
    summary = db.exec(
        select(DailySummary).where(
            DailySummary.clinic_id == clinic_id, DailySummary.date == on
        )
    ).first()
    if not summary:
        return None

    bookings = db.exec(
        select(Booking)
        .where(Booking.clinic_id == clinic_id, Booking.date == on)
        .order_by(Booking.token)
    ).all()
    patient_ids = {b.patient_id for b in bookings}
    patients_by_id: dict[int, Patient] = {}
    if patient_ids:
        rows = db.exec(select(Patient).where(Patient.id.in_(patient_ids))).all()
        patients_by_id = {p.id: p for p in rows}

    consults_by_hour: Counter[int] = Counter()
    for b in bookings:
        if b.status == BookingStatus.done and b.started_at:
            consults_by_hour[to_clinic_tz(b.started_at).hour] += 1

    hours_range = list(range(8, 23))  # show 08:00–22:00 clinic-local
    hourly = [HourBin(hour=h, consults=consults_by_hour.get(h, 0)) for h in hours_range]
    peak_count = max((h.consults for h in hourly), default=0)

    timeline = [TimelineRow(booking=b, patient=patients_by_id[b.patient_id]) for b in bookings if b.patient_id in patients_by_id]

    return DayDetailVM(summary=summary, hourly=hourly, timeline=timeline, peak_count=peak_count)
