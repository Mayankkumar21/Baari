from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlmodel import Session, select

from app.config import get_settings
from app.models import Booking, BookingStatus, Clinic, Patient
from app.services.auth import normalize_mobile
from app.time_utils import clinic_today, now_utc, to_clinic_tz


class BookingError(ValueError):
    """Validation failure during booking submission."""


DEFAULT_HOURS = {
    "morning": {"start": "10:00", "end": "13:00"},
    "evening": {"start": "17:00", "end": "21:00"},
}


def _clinic_hours(clinic: Clinic) -> dict:
    return clinic.opening_hours or DEFAULT_HOURS


def available_slots(clinic: Clinic, on: date, taken: set[datetime]) -> list[datetime]:
    """Return future, untaken slot times today (returned as aware-IST for display).

    `taken` is a set of naive-UTC datetimes from the DB. We convert each cursor to
    naive UTC for the membership check, but the slot list itself returns aware-IST
    values so the template's isoformat preserves IST and round-trips back through
    the form correctly.
    """
    tz = ZoneInfo(get_settings().clinic_tz)
    slot_len = clinic.slot_length_min or 20
    now = to_clinic_tz(now_utc())
    hours = _clinic_hours(clinic)
    slots: list[datetime] = []

    for block in hours.values():
        start_h, start_m = (int(x) for x in block["start"].split(":"))
        end_h, end_m = (int(x) for x in block["end"].split(":"))
        cursor = datetime.combine(on, time(start_h, start_m), tzinfo=tz)
        end = datetime.combine(on, time(end_h, end_m), tzinfo=tz)
        while cursor < end:
            cursor_utc_naive = cursor.astimezone(UTC).replace(tzinfo=None)
            if cursor >= now - timedelta(minutes=5) and cursor_utc_naive not in taken:
                slots.append(cursor)
            cursor += timedelta(minutes=slot_len)
    return slots


def get_taken_slots(db: Session, clinic_id: int, on: date) -> set[datetime]:
    rows = db.exec(
        select(Booking.slot_time).where(
            Booking.clinic_id == clinic_id,
            Booking.date == on,
            Booking.status != BookingStatus.cancelled,
        )
    ).all()
    return {r for r in rows}


def next_token(db: Session, clinic_id: int, on: date) -> int:
    max_token = db.exec(
        select(func.max(Booking.token)).where(
            Booking.clinic_id == clinic_id,
            Booking.date == on,
        )
    ).one()
    return (max_token or 0) + 1


def upsert_patient(
    db: Session, clinic_id: int, name: str, mobile: str, is_new: bool, whatsapp_opt_out: bool
) -> Patient:
    existing = db.exec(
        select(Patient).where(Patient.clinic_id == clinic_id, Patient.mobile == mobile)
    ).first()
    if existing:
        if existing.anonymized_at:
            raise BookingError("This patient record has been anonymized and cannot be booked.")
        if existing.name != name:
            existing.name = name
        existing.whatsapp_opt_out = whatsapp_opt_out
        db.add(existing)
        return existing
    p = Patient(
        clinic_id=clinic_id,
        name=name,
        mobile=mobile,
        is_new=is_new,
        whatsapp_opt_out=whatsapp_opt_out,
    )
    db.add(p)
    db.flush()
    return p


def reschedule_booking(
    db: Session,
    *,
    clinic_id: int,
    booking_id: int,
    new_slot_time: datetime,
) -> Booking:
    booking = db.get(Booking, booking_id)
    if not booking or booking.clinic_id != clinic_id:
        raise BookingError("Booking not found.")
    if booking.status in (
        BookingStatus.done,
        BookingStatus.no_show,
        BookingStatus.cancelled,
        BookingStatus.in_consult,
    ):
        raise BookingError(f"Cannot reschedule a {booking.status.value} booking.")
    if new_slot_time.date() != booking.date:
        raise BookingError("Reschedule must stay on the same day.")
    if new_slot_time == booking.slot_time:
        raise BookingError("Pick a different slot.")
    taken = get_taken_slots(db, clinic_id, booking.date)
    taken.discard(booking.slot_time)  # the current slot is the booking itself
    if new_slot_time in taken:
        raise BookingError("That slot is already taken.")
    booking.slot_time = new_slot_time
    booking.updated_at = now_utc()
    db.add(booking)
    return booking


def cancel_booking(db: Session, *, clinic_id: int, booking_id: int) -> Booking:
    booking = db.get(Booking, booking_id)
    if not booking or booking.clinic_id != clinic_id:
        raise BookingError("Booking not found.")
    if booking.status in (
        BookingStatus.done,
        BookingStatus.no_show,
        BookingStatus.cancelled,
    ):
        raise BookingError(f"Booking is already {booking.status.value}.")
    booking.status = BookingStatus.cancelled
    booking.cancelled_at = now_utc()
    booking.updated_at = now_utc()
    db.add(booking)
    return booking


def create_booking(
    db: Session,
    *,
    clinic: Clinic,
    created_by_user_id: int,
    name: str,
    mobile: str,
    slot_time: datetime,
    reason: str | None,
    is_new: bool,
    party_size: int,
    whatsapp_opt_out: bool,
) -> Booking:
    name = (name or "").strip()
    if not name or len(name) > 80:
        raise BookingError("Name is required (max 80 characters).")

    norm = normalize_mobile(mobile)
    if not norm:
        raise BookingError("Enter a valid 10-digit Indian mobile number.")

    if not (1 <= party_size <= 5):
        raise BookingError("Party size must be between 1 and 5.")

    if reason and len(reason) > 200:
        raise BookingError("Reason must be 200 characters or fewer.")

    on = clinic_today()
    taken = get_taken_slots(db, clinic.id, on)
    if slot_time in taken:
        raise BookingError("That slot was just taken. Please pick another.")
    if slot_time.date() != on:
        raise BookingError("Bookings can only be made for today.")

    patient = upsert_patient(
        db, clinic.id, name=name, mobile=norm, is_new=is_new, whatsapp_opt_out=whatsapp_opt_out
    )

    token = next_token(db, clinic.id, on)
    booking = Booking(
        clinic_id=clinic.id,
        patient_id=patient.id,
        date=on,
        token=token,
        slot_time=slot_time,
        reason=reason or None,
        party_size=party_size,
        status=BookingStatus.booked,
        created_by_user_id=created_by_user_id,
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    db.add(booking)
    db.flush()
    return booking
